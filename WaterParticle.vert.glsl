precision mediump float;
//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec3 LocalUv_TriangleIndex;
varying vec4 Rgba;
varying vec3 TriangleUvIndex;
varying float3 FragWorldPos;

uniform sampler2D	NoiseImage;
uniform float Time;
const float Water_TimeScale = 3.0;
const float WorldPosScale = 2.0;
const float Water_PosScale = 40.0;
const float Water_HeightScale = 0.3;




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

//	https://github.com/djwhatle/glsl-water-sim/blob/master/assignment4/glslWater.vert
float wave_generate(float A, float D_x, float D_z, float f, float x, float z, float p, float t, float k)
{
	return A*pow((sin((D_x*x+D_z*z)*f+t*p)*0.5+0.5), k);
}

float GetWave1(float2 uv)
{
	float time = Time * Water_TimeScale;
	float amplitude = 1.0;
	float frequency = 0.2;
	float direction_x = -1.0;
	float direction_z = -0.7;
	float phase = 0.5;
	float sharpness = 2.0;
	float sine_result_1 = wave_generate( amplitude, direction_x, direction_z, frequency, uv.x, uv.y, phase, time, sharpness);
	return sine_result_1;
}

float GetWave2(float2 uv)
{
	float time = Time * Water_TimeScale;
	float amplitude = 0.5;
	float frequency = 0.4;
	float direction_x = 0.0;
	float direction_z = 0.7;
	float phase = 1.3;
	float sharpness = 2.0;
	float sine_result_2 = wave_generate( amplitude, direction_x, direction_z, frequency, uv.x, uv.y, phase, time, sharpness);
	return sine_result_2;
}


float GetWave3(float2 uv)
{
	float time = Time * Water_TimeScale;
	float amplitude = 0.3;
	float frequency = 0.8;
	float direction_x = -0.3;
	float direction_z = 0.5;
	float phase = 2.3;
	float sharpness = 2.0;
	float sine_result_2 = wave_generate( amplitude, direction_x, direction_z, frequency, uv.x, uv.y, phase, time, sharpness);
	return sine_result_2;
}

float3 GetWaterNoiseOffset(float2 Mapuv)
{
	float Lod = 0.0;
	/*
	float NoiseA = textureLod( NoiseImage, Mapuv, Lod ).x;
	NoiseA *= NoiseA;
	NoiseA *= NoiseA;
	NoiseA *= 1.5;
	//NoiseA = 1.0 - NoiseA;
	//float NoiseB = textureLod( NoiseImage, Mapuv.yx, Lod ).y;

	//float NoiseA = textureLod( NoiseImage, Mapuv, Lod ).x;
	//NoiseA *= NoiseA;
	
	float Noise = NoiseA;
	*/
	float SpaceScalar = Water_PosScale;
	float Noise = 0.0;
	Noise += GetWave1(Mapuv * float2(SpaceScalar,SpaceScalar));
	Noise += GetWave2(Mapuv * float2(SpaceScalar,SpaceScalar));
	Noise += GetWave3(Mapuv * float2(SpaceScalar,SpaceScalar));
	Noise *= Water_HeightScale;
	//Noise *= Noise;
	//Noise *= Noise;
	return float3( 0.0, Noise, 0.0 );
}


void GetTriangleWorldPosAndColour(float TriangleIndex,out float3 WorldPos,out float4 Colour)
{
	float2 uv = GetTriangleUvf( TriangleIndex );
	float Lod = 0.0;
	
	float3 GridPos = textureLod( WorldPositions, uv, Lod ).xyz;
	float3 WorldPosScale3 = float3( WorldPosScale, WorldPosScale, WorldPosScale );
	//	for some reason, this doesn't give me y=0
	GridPos.y = 0.0;
	WorldPos = mix( -WorldPosScale3, WorldPosScale3, GridPos );	//	* bounds, repeat etc
	WorldPos.y = 0.0;
	
	float2 NoiseUv = GridPos.xz;
	float3 WaterNoise = GetWaterNoiseOffset( NoiseUv );
	
	WorldPos += WaterNoise;
	//Colour = float4( GridPos, 1 );
	/*
	Colour = float4( NoiseUv, 0, 1 );
	if ( NoiseUv.x > 1.0 )
		Colour = float4( 0, 0, 1, 1 );
*/
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
