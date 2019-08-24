attribute vec2 Vertex;
varying vec2 TriangleUv;

uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;

uniform float LocalScale;
uniform float WorldScale;

uniform vec3 LocalPositions[3];/* = vec3[3](
								vec3( -1,-1,0 ),
								vec3( 1,-1,0 ),
								vec3( 0,1,0 )
								);*/


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


void main()
{
	int VertexIndex = int(Vertex.x);
	int TriangleIndex = int(Vertex.y);
	
	float3 VertexPos = LocalPositions[VertexIndex] * LocalScale;
	float3 LocalPos = VertexPos;
	
	float3 WorldPos = GetTriangleWorldPos(TriangleIndex) * WorldScale;
	WorldPos += LocalPos;
	
	float4 ProjectionPos = float4( WorldPos.x, WorldPos.y, 0, 1 );
	gl_Position = ProjectionPos;
	
	TriangleUv = LocalPositions[VertexIndex].xy;
}

