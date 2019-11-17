precision highp float;
//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec3 LocalUv_TriangleIndex;
varying vec4 Rgba;
varying vec3 TriangleUvIndex;
varying float3 FragWorldPos;

//	worldpositions now an offset from orig
uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;
uniform sampler2D OrigPositions;
uniform float3 OrigPositionsBoundingBox[2];
const float2 PositionScalarMinMax = float2(0.1,2.0);
const float2 VelocityScalarMinMax = float2(0.005,0.5);
const float2 OrigPositionScalarMinMax = float2(0.0,1.0);

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


float3 GetScaledInput(float2 uv,sampler2D Texture,float2 ScalarMinMax)
{
	/*
	if ( FirstUpdate )
		return float3(0,0,0);
	*/
	float Lod = 0.0;
	vec4 Pos = textureLod( Texture, uv, Lod );
	
	{
		Pos.xyz -= float3( 0.5, 0.5, 0.5 );
		Pos.xyz *= 2.0;
		Pos.xyz *= mix( ScalarMinMax.x, ScalarMinMax.y, Pos.w );
	}
	return Pos.xyz;
}

float3 GetInputPositionOffset(float2 uv)
{
	return GetScaledInput( uv, WorldPositions, PositionScalarMinMax );
}

float3 GetInputOrigPosition(float2 uv)
{
	float2 ScalarMinMax = OrigPositionScalarMinMax;
	float Lod = 0.0;
	vec4 Pos = textureLod( OrigPositions, uv, Lod );
	if ( Pos.w != 1.0 )
	{
		Pos.xyz -= float3( 0.5, 0.5, 0.5 );
		Pos.xyz *= 2.0;
		Pos.xyz *= mix( ScalarMinMax.x, ScalarMinMax.y, Pos.w );
	}
	return Pos.xyz;
}

void GetTriangleWorldPosAndColour(float TriangleIndex,out float3 WorldPos,out float4 Colour)
{
	float2 uv = GetTriangleUvf( TriangleIndex );
	float Lod = 0.0;
	
	float3 OrigPos = GetInputOrigPosition( uv );
	float3 Offset = GetInputPositionOffset( uv );
	WorldPos = OrigPos + Offset;
#if defined(TEST_ONE_COLOUR)
	Colour = TEST_ONE_COLOUR;
#else
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


void main()
{
	main_BillBoardCameraSpace();
	//main_WorldSpace();
}
