#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vector3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self::new(0.0, 0.0, 0.0)
    }

    pub fn add(self, other: Self) -> Self {
        Self::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }

    pub fn sub(self, other: Self) -> Self {
        Self::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    pub fn scale(self, value: f64) -> Self {
        Self::new(self.x * value, self.y * value, self.z * value)
    }

    pub fn dot(self, other: Self) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn cross(self, other: Self) -> Self {
        Self::new(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )
    }

    pub fn length(self) -> f64 {
        self.dot(self).sqrt()
    }

    pub fn normalize(self) -> Self {
        let len = self.length();
        if len > 0.0 {
            self.scale(1.0 / len)
        } else {
            self
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Matrix4 {
    pub elements: [f64; 16],
}

impl Matrix4 {
    pub fn identity() -> Self {
        let mut elements = [0.0; 16];
        elements[0] = 1.0;
        elements[5] = 1.0;
        elements[10] = 1.0;
        elements[15] = 1.0;
        Self { elements }
    }

    pub fn multiply(a: Self, b: Self) -> Self {
        let ae = a.elements;
        let be = b.elements;
        let mut out = [0.0; 16];

        let a00 = ae[0];
        let a01 = ae[1];
        let a02 = ae[2];
        let a03 = ae[3];
        let a10 = ae[4];
        let a11 = ae[5];
        let a12 = ae[6];
        let a13 = ae[7];
        let a20 = ae[8];
        let a21 = ae[9];
        let a22 = ae[10];
        let a23 = ae[11];
        let a30 = ae[12];
        let a31 = ae[13];
        let a32 = ae[14];
        let a33 = ae[15];

        let b00 = be[0];
        let b01 = be[1];
        let b02 = be[2];
        let b03 = be[3];
        let b10 = be[4];
        let b11 = be[5];
        let b12 = be[6];
        let b13 = be[7];
        let b20 = be[8];
        let b21 = be[9];
        let b22 = be[10];
        let b23 = be[11];
        let b30 = be[12];
        let b31 = be[13];
        let b32 = be[14];
        let b33 = be[15];

        out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

        Self { elements: out }
    }

    pub fn perspective(fov_y: f64, aspect: f64, near: f64, far: f64) -> Self {
        let f = 1.0 / (fov_y * 0.5).tan();
        let nf = 1.0 / (near - far);
        let mut elements = [0.0; 16];
        elements[0] = f / aspect;
        elements[5] = f;
        elements[10] = (far + near) * nf;
        elements[11] = -1.0;
        elements[14] = 2.0 * far * near * nf;
        Self { elements }
    }

    pub fn look_at(eye: Vector3, target: Vector3, up: Vector3) -> Self {
        let z_axis = eye.sub(target).normalize();
        let x_axis = up.cross(z_axis).normalize();
        let y_axis = z_axis.cross(x_axis).normalize();

        let mut elements = [0.0; 16];
        elements[0] = x_axis.x;
        elements[1] = y_axis.x;
        elements[2] = z_axis.x;
        elements[4] = x_axis.y;
        elements[5] = y_axis.y;
        elements[6] = z_axis.y;
        elements[8] = x_axis.z;
        elements[9] = y_axis.z;
        elements[10] = z_axis.z;
        elements[12] = -x_axis.dot(eye);
        elements[13] = -y_axis.dot(eye);
        elements[14] = -z_axis.dot(eye);
        elements[15] = 1.0;
        Self { elements }
    }

    pub fn compose(position: Vector3, rotation: Vector3, scale: Vector3) -> Self {
        let (sx, cx) = rotation.x.sin_cos();
        let (sy, cy) = rotation.y.sin_cos();
        let (sz, cz) = rotation.z.sin_cos();

        let m11 = cy * cz;
        let m12 = cy * sz;
        let m13 = -sy;
        let m21 = sx * sy * cz - cx * sz;
        let m22 = sx * sy * sz + cx * cz;
        let m23 = sx * cy;
        let m31 = cx * sy * cz + sx * sz;
        let m32 = cx * sy * sz - sx * cz;
        let m33 = cx * cy;

        let mut elements = [0.0; 16];
        elements[0] = m11 * scale.x;
        elements[1] = m21 * scale.x;
        elements[2] = m31 * scale.x;
        elements[4] = m12 * scale.y;
        elements[5] = m22 * scale.y;
        elements[6] = m32 * scale.y;
        elements[8] = m13 * scale.z;
        elements[9] = m23 * scale.z;
        elements[10] = m33 * scale.z;
        elements[12] = position.x;
        elements[13] = position.y;
        elements[14] = position.z;
        elements[15] = 1.0;
        Self { elements }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Mesh {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
}

impl Mesh {
    pub fn cube(size: f32) -> Self {
        let s = size * 0.5;
        let positions = vec![
            -s, -s, -s, s, -s, -s, s, s, -s, -s, s, -s, -s, -s, s, s, -s, s, s,
            s, s, -s, s, s,
        ];
        let indices = vec![
            0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4, 0, 4, 7, 7, 3, 0, 1, 5, 6, 6,
            2, 1, 3, 2, 6, 6, 7, 3, 0, 1, 5, 5, 4, 0,
        ];
        Self { positions, indices }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_length() {
        let v = Vector3::new(3.0, 4.0, 0.0);
        assert_eq!(v.length(), 5.0);
    }

    #[test]
    fn matrix_identity() {
        let m = Matrix4::identity();
        assert_eq!(m.elements[0], 1.0);
        assert_eq!(m.elements[5], 1.0);
        assert_eq!(m.elements[10], 1.0);
        assert_eq!(m.elements[15], 1.0);
    }
}
