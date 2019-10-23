precision highp float;
//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec3 LocalUv_TriangleIndex;
varying vec4 Rgba;
varying vec3 TriangleUvIndex;
varying float3 FragWorldPos;

uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;

uniform int TriangleCount;

uniform mat4 CameraToWorldTransform;
uniform mat4 LocalToWorldTransform;
uniform mat4 WorldToCameraTransform;
uniform mat4 CameraProjectionTransform;

uniform vec3 LocalPositions[3];/* = vec3[3](
								vec3( -1,-1,0 ),
								vec3( 1,-1,0 ),
								vec3( 0,1,0 )
								);*/
//#define TEST_ONE_COLOUR	vec4(0,1,0,1)

#if !defined(TEST_ONE_COLOUR)
uniform sampler2D	ColourImage;
#endif

uniform float TriangleScale;// = 0.06;

#define BillboardTriangles	true

const bool ShiftDustParticles = true;
uniform vec3 DustParticlesBounds;
uniform float DustParticlesOffset;


vec2 GetTriangleUvf(float TriangleIndex)
{
	float t = TriangleIndex;
	
	float Widthf = float(WorldPositionsWidth);
	float WidthInv = 1.0 / Widthf;
	
	//	index->uv
	float x = mod( t, Widthf );
	float y = (t-x) * WidthInv;
	float u = x * WidthInv;
	float v = y / float(WorldPositionsHeight);
		
	float2 uv = float2(u,v);
	return uv;
}

vec2 GetTriangleUv(int TriangleIndex)
{
	return GetTriangleUvf( float(TriangleIndex) );
}

vec3 GetTriangleWorldPosFromUv(float2 TriangleUv)
{
	float2 uv = TriangleUv;
	float Lod = 0.0;
	float3 LocalPos = textureLod( WorldPositions, uv, Lod ).xyz;
	float3 xyz = LocalPos;
	
	//	repeat points, find the nearest block in front of the camera for this pos
	float4 CameraPos4 = CameraToWorldTransform * float4(0,0,DustParticlesOffset,1);
	float3 CameraPos = CameraPos4.xyz / CameraPos4.w;
	
	float3 BoxSize = DustParticlesBounds;//float3( 2.0, 2.0, 6.0 );
	float3 CameraBlockRemainder = mod( CameraPos, BoxSize );
	
	//	move to block
	CameraPos -= CameraBlockRemainder;
	float3 Offset = float3(0,0,0);
	
	//	shift to wrap points
	CameraBlockRemainder /= BoxSize;
	Offset = xyz - CameraBlockRemainder;
	
	if ( ShiftDustParticles )
	{
		if ( Offset.x > 0.5 )		Offset.x = -1.0;
		else if ( Offset.x < -0.5 )	Offset.x = 1.0;
		else 						Offset.x = 0.0;
		
		if ( Offset.y > 0.5 )		Offset.y = -1.0;
		else if ( Offset.y < -0.5 )	Offset.y = 1.0;
		else 						Offset.y = 0.0;
		
		if ( Offset.z > 0.5 )		Offset.z = -1.0;
		else if ( Offset.z < -0.5 )	Offset.z = 1.0;
		else 						Offset.z = 0.0;
	}
	
	xyz += Offset;
	xyz *= BoxSize;
	xyz += CameraPos;
	
	return xyz;
}

vec3 GetTriangleWorldPos(int TriangleIndex)
{
	float2 uv = GetTriangleUv( TriangleIndex );
	return GetTriangleWorldPosFromUv( uv );
}

void GetTriangleWorldPosAndColour(float TriangleIndex,out float3 WorldPos,out float4 Colour)
{
	float2 uv = GetTriangleUvf( TriangleIndex );
	WorldPos = GetTriangleWorldPosFromUv( uv );

#if defined(TEST_ONE_COLOUR)
	Colour = TEST_ONE_COLOUR;
#else
	float Lod = 0.0;
	float4 ColourImageColour = textureLod( ColourImage, uv, Lod );
	Colour = float4(ColourImageColour.xyz,1);
#endif
	
}

int modi(int Value,int Size)
{
	//if ( Size <= 0 )
	//	return 0;
	
	float f = mod( float(Value), float(Size) );
	return int(f);
}

vec4 GetTriangleColour(int TriangleIndex)
{
#if defined(TEST_ONE_COLOUR)
	return TEST_ONE_COLOUR;
#else
	float Lod = 0.0;
	float2 uv = GetTriangleUv( TriangleIndex );
	float4 ColourImageColour = textureLod( ColourImage, uv, Lod );
	return float4(ColourImageColour.xyz,1);
#endif
}



void main_BillBoardCameraSpace()
{
	float TriangleIndexf = LocalUv_TriangleIndex.z;

	float3 TriangleWorldPos;
	GetTriangleWorldPosAndColour( TriangleIndexf, TriangleWorldPos, Rgba );
	
	float2 Localuv = LocalUv_TriangleIndex.xy;

	float4 WorldPos = LocalToWorldTransform * float4(TriangleWorldPos,1);
	float4 CameraPos = WorldToCameraTransform * WorldPos;

	float2 VertexPos = Localuv * TriangleScale;
	CameraPos.xy += VertexPos;

	float4 ProjectionPos = CameraProjectionTransform * CameraPos;
	gl_Position = ProjectionPos;
	/*
	if ( TriangleIndexf >= float(TriangleCount) )
	{
		Rgba = float4(0,1,0,1);
		//gl_Position = float4(0,0,0,0);
	}
	*/
	FragWorldPos = WorldPos.xyz;
	TriangleUvIndex = float3( Localuv, TriangleIndexf );
}

/*
void main_WorldSpace()
{
	int VertexIndex = int(Vertex.x);
	int TriangleIndex = int(Vertex.y);
	float TriangleIndexf = Vertex.y;
	
	float3 VertexPos = LocalPositions[VertexIndex] * TriangleScale;
	float3 LocalPos = VertexPos;
	
	float3 TriangleWorldPos = GetTriangleWorldPos(TriangleIndex);
	float4 WorldPos;
	
	WorldPos = LocalToWorldTransform * float4(LocalPos,1);
	WorldPos.xyz += TriangleWorldPos;
	
	float4 CameraPos = WorldToCameraTransform * WorldPos;
	CameraPos.xyz += VertexPos;
	
	float4 ProjectionPos = CameraProjectionTransform * CameraPos;
	gl_Position = ProjectionPos;
	
	FragWorldPos = WorldPos.xyz;
	TriangleUvIndex = float3( LocalPositions[VertexIndex].xy, TriangleIndexf );
	Rgba = GetTriangleColour(TriangleIndex);
}
*/

void main()
{
	main_BillBoardCameraSpace();
	//main_WorldSpace();
}
