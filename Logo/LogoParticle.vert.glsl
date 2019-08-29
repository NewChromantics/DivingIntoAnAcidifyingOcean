attribute vec2 Vertex;
varying vec2 TriangleUv;

uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;

uniform float LocalScale;
uniform float WorldScale;
uniform float ProjectionAspectRatio;

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

float GetTriangleLocalScale(int TriangleIndex)
{
	float2 uv = GetTriangleUv( TriangleIndex );
	float Lod = 0.0;
	//	gr: this is wierdly always 1
	float Radius = textureLod( WorldPositions, uv, Lod ).w;

	//	bad texture?
	if ( Radius == 0.0 )
	{
		//Radius = 1.0;
	}
	
	//Radius *= 100.0;

	Radius *= LocalScale;
	return Radius;
}


void main()
{
	int VertexIndex = int(Vertex.x);
	int TriangleIndex = int(Vertex.y);
	
	float3 VertexPos = LocalPositions[VertexIndex] * GetTriangleLocalScale(VertexIndex);
	float3 LocalPos = VertexPos;
	
	float3 WorldPos = GetTriangleWorldPos(TriangleIndex) * WorldScale;
	WorldPos += LocalPos;
	
	float4 ProjectionPos = float4( WorldPos.x * ProjectionAspectRatio, WorldPos.y, 0, 1 );
	gl_Position = ProjectionPos;
	
	TriangleUv = LocalPositions[VertexIndex].xy;
}

