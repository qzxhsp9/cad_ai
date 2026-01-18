#include <BRepMesh_IncrementalMesh.hxx>
#include <BRep_Tool.hxx>
#include <Poly_Triangulation.hxx>
#include <STEPControl_Reader.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>
#include <TopLoc_Location.hxx>

#include <cmath>
#include <cstring>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

struct Vec3 {
  double x;
  double y;
  double z;
};

struct Bounds {
  Vec3 min;
  Vec3 max;
};

struct MeshData {
  std::vector<double> positions;
  std::vector<double> normals;
  std::vector<unsigned int> indices;
};

static double readDouble(const char* value, double fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return std::stod(value);
  } catch (...) {
    return fallback;
  }
}

static double unitScale(const std::string& unit) {
  if (unit == "m") {
    return 1.0;
  }
  return 0.001;
}

static void updateBounds(Bounds& bounds, const Vec3& point) {
  bounds.min.x = std::min(bounds.min.x, point.x);
  bounds.min.y = std::min(bounds.min.y, point.y);
  bounds.min.z = std::min(bounds.min.z, point.z);
  bounds.max.x = std::max(bounds.max.x, point.x);
  bounds.max.y = std::max(bounds.max.y, point.y);
  bounds.max.z = std::max(bounds.max.z, point.z);
}

static Vec3 subtract(const Vec3& a, const Vec3& b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

static Vec3 cross(const Vec3& a, const Vec3& b) {
  return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x};
}

static Vec3 normalize(const Vec3& value) {
  const double length = std::sqrt(value.x * value.x + value.y * value.y + value.z * value.z);
  if (length <= 1e-12) {
    return {0.0, 0.0, 0.0};
  }
  return {value.x / length, value.y / length, value.z / length};
}

static void appendVertex(MeshData& mesh, const Vec3& point, const Vec3& normal) {
  mesh.positions.push_back(point.x);
  mesh.positions.push_back(point.y);
  mesh.positions.push_back(point.z);
  mesh.normals.push_back(normal.x);
  mesh.normals.push_back(normal.y);
  mesh.normals.push_back(normal.z);
  mesh.indices.push_back(static_cast<unsigned int>(mesh.indices.size()));
}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::cerr << "Usage: occt_step_export <file.step> [--deflection 0.2] [--angle 0.5] [--unit mm]\n";
    return 1;
  }

  std::string filePath = argv[1];
  double deflection = 0.2;
  double angle = 0.5;
  std::string unit = "mm";

  for (int i = 2; i < argc; i += 1) {
    if (std::strcmp(argv[i], "--deflection") == 0 && i + 1 < argc) {
      deflection = readDouble(argv[i + 1], deflection);
      i += 1;
      continue;
    }
    if (std::strcmp(argv[i], "--angle") == 0 && i + 1 < argc) {
      angle = readDouble(argv[i + 1], angle);
      i += 1;
      continue;
    }
    if (std::strcmp(argv[i], "--unit") == 0 && i + 1 < argc) {
      unit = argv[i + 1];
      i += 1;
      continue;
    }
  }

  STEPControl_Reader reader;
  if (reader.ReadFile(filePath.c_str()) != IFSelect_RetDone) {
    std::cerr << "Failed to read STEP file.\n";
    return 1;
  }

  reader.TransferRoots();
  TopoDS_Shape shape = reader.OneShape();
  if (shape.IsNull()) {
    std::cerr << "STEP file has no shapes.\n";
    return 1;
  }

  BRepMesh_IncrementalMesh mesher(shape, deflection, false, angle, true);
  if (!mesher.IsDone()) {
    std::cerr << "Meshing failed.\n";
    return 1;
  }

  MeshData mesh;
  const double scale = unitScale(unit);
  Bounds bounds{
      {std::numeric_limits<double>::max(), std::numeric_limits<double>::max(), std::numeric_limits<double>::max()},
      {std::numeric_limits<double>::lowest(), std::numeric_limits<double>::lowest(), std::numeric_limits<double>::lowest()}};

  for (TopExp_Explorer exp(shape, TopAbs_FACE); exp.More(); exp.Next()) {
    TopoDS_Face face = TopoDS::Face(exp.Current());
    TopLoc_Location location;
    Handle(Poly_Triangulation) triangulation = BRep_Tool::Triangulation(face, location);
    if (triangulation.IsNull()) {
      continue;
    }

    const gp_Trsf transform = location.Transformation();
    const auto& triangles = triangulation->Triangles();
    const bool reversed = (face.Orientation() == TopAbs_REVERSED);

    for (int i = triangles.Lower(); i <= triangles.Upper(); i += 1) {
      int i1;
      int i2;
      int i3;
      triangles(i).Get(i1, i2, i3);

      gp_Pnt p1 = triangulation->Node(i1).Transformed(transform);
      gp_Pnt p2 = triangulation->Node(i2).Transformed(transform);
      gp_Pnt p3 = triangulation->Node(i3).Transformed(transform);

      Vec3 v1{p1.X() * scale, p1.Y() * scale, p1.Z() * scale};
      Vec3 v2{p2.X() * scale, p2.Y() * scale, p2.Z() * scale};
      Vec3 v3{p3.X() * scale, p3.Y() * scale, p3.Z() * scale};

      Vec3 normal = normalize(cross(subtract(v2, v1), subtract(v3, v1)));
      if (reversed) {
        normal.x *= -1.0;
        normal.y *= -1.0;
        normal.z *= -1.0;
      }

      appendVertex(mesh, v1, normal);
      appendVertex(mesh, v2, normal);
      appendVertex(mesh, v3, normal);

      updateBounds(bounds, v1);
      updateBounds(bounds, v2);
      updateBounds(bounds, v3);
    }
  }

  if (mesh.positions.empty()) {
    std::cerr << "No mesh data extracted.\n";
    return 1;
  }

  std::cout << "{";
  std::cout << "\"bounds\":{\"min\":["
            << bounds.min.x << "," << bounds.min.y << "," << bounds.min.z << "],\"max\":["
            << bounds.max.x << "," << bounds.max.y << "," << bounds.max.z << "]},";
  std::cout << "\"meshes\":[{";
  std::cout << "\"id\":\"mesh-0\",";
  std::cout << "\"positions\":[";
  for (size_t i = 0; i < mesh.positions.size(); i += 1) {
    if (i > 0) {
      std::cout << ",";
    }
    std::cout << mesh.positions[i];
  }
  std::cout << "],";
  std::cout << "\"normals\":[";
  for (size_t i = 0; i < mesh.normals.size(); i += 1) {
    if (i > 0) {
      std::cout << ",";
    }
    std::cout << mesh.normals[i];
  }
  std::cout << "],";
  std::cout << "\"indices\":[";
  for (size_t i = 0; i < mesh.indices.size(); i += 1) {
    if (i > 0) {
      std::cout << ",";
    }
    std::cout << mesh.indices[i];
  }
  std::cout << "]";
  std::cout << "}],";
  std::cout << "\"edges\":[]";
  std::cout << "}";

  return 0;
}
