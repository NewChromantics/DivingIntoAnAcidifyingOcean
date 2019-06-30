#version 410
uniform vec4 VertexRect = vec4(0,0,1,1);
in vec2 Vertex;
out vec4 Rgba;
out vec2 TriangleUv;
out vec3 FragWorldPos;
out vec4 Sphere4;	//	the shape rendered by this triangle in world space

uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;

uniform mat4 CameraProjectionMatrix;
uniform float3 CameraWorldPosition = float3(0,0,-10);

uniform vec3 LocalPositions[3] = vec3[3](
										vec3( -1,-1,0 ),
										vec3( 1,-1,0 ),
										vec3( 0,1,0 )
										);
#define MAX_COLOUR_COUNT	16
uniform int ColourCount = 0;
uniform vec3 Colours[MAX_COLOUR_COUNT];

uniform float TriangleScale = 0.06;
uniform float3 Transform_WorldPosition = float3(0,0,0);

//	world space
#define SphereRadius (TriangleScale * 0.5)
//uniform float SphereRadius = 0.04;

vec3 GetTriangleWorldPos(int TriangleIndex)
{
	float t = float(TriangleIndex);
	
	//	index->uv
	float x = mod( t, WorldPositionsWidth );
	float y = (t-x) / WorldPositionsWidth;
	float u = x / float(WorldPositionsWidth);
	float v = y / float(WorldPositionsHeight);
	float3 xyz = textureLod( WorldPositions, float2(u,v), 0 ).xyz;
	//float3 xyz = float3( x,y,0 );
	return xyz + Transform_WorldPosition;
}

vec3 GetTriangleColour(int TriangleIndex)
{
	if ( ColourCount == 0 )
		return vec3(1,0,0);
	
	return Colours[ TriangleIndex % ColourCount];
}

void main()
{
	int VertexIndex = int(Vertex.x);
	int TriangleIndex = int(Vertex.y);
	
	float3 LocalPos = LocalPositions[VertexIndex] * TriangleScale;
	float3 TrianglePos = GetTriangleWorldPos(TriangleIndex);
	float3 WorldPos = TrianglePos + LocalPos;
	float3 CameraPos = WorldPos - CameraWorldPosition;	//	world to camera space
	float4 ProjectionPos = CameraProjectionMatrix * float4( CameraPos, 1 );
	gl_Position = ProjectionPos;
	
	Rgba = float4( GetTriangleColour(TriangleIndex), 1 );
	TriangleUv = LocalPositions[VertexIndex].xy;
	FragWorldPos = WorldPos;
	Sphere4 = float4( TrianglePos, SphereRadius );
}

