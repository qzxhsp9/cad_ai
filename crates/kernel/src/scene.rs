use std::collections::BTreeMap;

use crate::Vector3;

pub type EntityId = u64;
pub type ComponentId = u64;
pub type AssetId = u64;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SchemaVersion {
    V0,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Axis {
    X,
    Y,
    Z,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Unit {
    Mm,
    Cm,
    M,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SceneMetadata {
    pub name: String,
    pub description: Option<String>,
    pub unit: Unit,
    pub up_axis: Axis,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Aabb {
    pub min: Vector3,
    pub max: Vector3,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TransformComponent {
    pub position: Vector3,
    pub rotation: Vector3,
    pub scale: Vector3,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum GeometryTopology {
    Triangles,
    Lines,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GeometryComponent {
    pub mesh: AssetId,
    pub topology: GeometryTopology,
    pub local_bounds: Option<Aabb>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MaterialComponent {
    pub base_color: [f32; 4],
    pub metallic: f32,
    pub roughness: f32,
    pub opacity: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LayerComponent {
    pub name: String,
    pub visible: bool,
    pub locked: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MetadataComponent {
    pub tags: Vec<String>,
    pub properties: BTreeMap<String, MetadataValue>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum MetadataValue {
    String(String),
    Number(f64),
    Bool(bool),
    Null,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ComponentRefs {
    pub transform: Option<ComponentId>,
    pub geometry: Option<ComponentId>,
    pub material: Option<ComponentId>,
    pub layer: Option<ComponentId>,
    pub metadata: Option<ComponentId>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EntityRecord {
    pub id: EntityId,
    pub name: Option<String>,
    pub components: ComponentRefs,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ComponentTable {
    pub transforms: BTreeMap<ComponentId, TransformComponent>,
    pub geometries: BTreeMap<ComponentId, GeometryComponent>,
    pub materials: BTreeMap<ComponentId, MaterialComponent>,
    pub layers: BTreeMap<ComponentId, LayerComponent>,
    pub metadata: BTreeMap<ComponentId, MetadataComponent>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum IndexFormat {
    Uint16,
    Uint32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BufferLayoutEntry {
    pub offset: u32,
    pub stride: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BufferLayout {
    pub position: BufferLayoutEntry,
    pub normal: Option<BufferLayoutEntry>,
    pub uv: Option<BufferLayoutEntry>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MeshAsset {
    pub id: AssetId,
    pub name: Option<String>,
    pub vertex_count: u32,
    pub index_count: u32,
    pub index_format: IndexFormat,
    pub topology: GeometryTopology,
    pub layout: BufferLayout,
    pub source_uri: Option<String>,
    pub bounds: Option<Aabb>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MaterialAsset {
    pub id: AssetId,
    pub name: Option<String>,
    pub base_color: [f32; 4],
}

#[derive(Clone, Debug, PartialEq)]
pub struct TextureAsset {
    pub id: AssetId,
    pub name: Option<String>,
    pub uri: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AssetRegistry {
    pub meshes: BTreeMap<AssetId, MeshAsset>,
    pub materials: BTreeMap<AssetId, MaterialAsset>,
    pub textures: BTreeMap<AssetId, TextureAsset>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SceneGraph {
    pub schema_version: SchemaVersion,
    pub metadata: SceneMetadata,
    pub entities: Vec<EntityRecord>,
    pub components: ComponentTable,
    pub assets: AssetRegistry,
}
