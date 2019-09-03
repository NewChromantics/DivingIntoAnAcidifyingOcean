//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec2 Vertex;
varying vec4 Rgba;
varying vec2 TriangleUv;
varying float3 FragWorldPos;

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
uniform sampler2D ColourImage;

uniform float TriangleScale;// = 0.06;

#define BillboardTriangles	true


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

vec4 GetTriangleColour(int TriangleIndex)
{
	float Lod = 0.0;
	float2 uv = GetTriangleUv( TriangleIndex );
	return textureLod( ColourImage, uv, Lod );
	//return float4(0,0,1,1);
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

	FragWorldPos = WorldPos.xyz;
	TriangleUv = LocalPositions[VertexIndex].xy;
	Rgba = GetTriangleColour(TriangleIndex);
}

