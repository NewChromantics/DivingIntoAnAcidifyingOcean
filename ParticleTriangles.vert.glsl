//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec2 Vertex;
varying vec4 Rgba;
varying vec2 TriangleUv;
varying vec3 FragWorldPos;
varying vec4 Sphere4;	//	the shape rendered by this triangle in world space

uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;

uniform mat4 CameraToWorldTransform;
uniform mat4 LocalToWorldTransform;
uniform mat4 WorldToCameraTransform;
uniform mat4 CameraProjectionTransform;

uniform vec3 LocalPositions[3];/* = vec3[3](
								vec3( -1,-1,0 ),
								vec3( 1,-1,0 ),
								vec3( 0,1,0 )
								);*/
#define MAX_COLOUR_COUNT	16
uniform int ColourCount;//= 0;
uniform vec3 Colours[MAX_COLOUR_COUNT];
uniform sampler2D ColourImage;

uniform float TriangleScale;// = 0.06;

uniform bool BillboardTriangles;// = true;

//	world space
#define SphereRadius (TriangleScale * 0.5)
//uniform float SphereRadius = 0.04;


vec2 GetTriangleUv(int TriangleIndex)
{
	float t = float(TriangleIndex);
	
	//	index->uv
	float x = mod( t, float(WorldPositionsWidth) );
	float y = (t-x) / float(WorldPositionsWidth);
	float u = x / float(WorldPositionsWidth);
	float v = y / float(WorldPositionsHeight);

	float2 uv = float2(u,v);
	return uv;
}

vec3 GetTriangleWorldPos(int TriangleIndex)
{
	float2 uv = GetTriangleUv( TriangleIndex );
	float Lod = 0.0;
	float3 xyz = textureLod( WorldPositions, uv, Lod ).xyz;
	return xyz;
}

int modi(int Value,int Size)
{
	float f = mod( float(Value), float(Size) );
	return int(f);
}

vec4 GetTriangleColour(int TriangleIndex)
{
	//	colour from colour table
	if ( ColourCount > 0 )
	{
		TriangleIndex = modi( TriangleIndex, ColourCount );
		return float4( Colours[TriangleIndex], 1 );
	}
	
	float Lod = 0.0;
	float2 uv = GetTriangleUv( TriangleIndex );
	return textureLod( ColourImage, uv, Lod );
}

void main()
{
	int VertexIndex = int(Vertex.x);
	int TriangleIndex = int(Vertex.y);
	
	float3 VertexPos = LocalPositions[VertexIndex] * TriangleScale;
	float3 LocalPos = VertexPos;
	if ( BillboardTriangles )
		LocalPos = float3(0,0,0);
	
	float3 TriangleWorldPos = GetTriangleWorldPos(TriangleIndex);
	float4 WorldPos = LocalToWorldTransform * float4(LocalPos,1);
	WorldPos.xyz += TriangleWorldPos;
	WorldPos.w = 1.0;
	float4 CameraPos = WorldToCameraTransform * WorldPos;
	if ( BillboardTriangles )
	{
		//	gr: this seems like a fix for scale difference, but need to figure out if it's accurate
		CameraPos.xyz += VertexPos;//*0.5;
		CameraPos.w = 1.0;
	}
	float4 ProjectionPos = CameraProjectionTransform * CameraPos;
	gl_Position = ProjectionPos;
	
	Rgba = GetTriangleColour(TriangleIndex);
	TriangleUv = LocalPositions[VertexIndex].xy;
	WorldPos = CameraToWorldTransform * float4(CameraPos.xyz,1);
	//WorldPos.xyz /= WorldPos.w;
	FragWorldPos = WorldPos.xyz;
	TriangleWorldPos += (LocalToWorldTransform * float4(0,0,0,1)).xyz;
	Sphere4 = float4( TriangleWorldPos, SphereRadius );
}

