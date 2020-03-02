precision highp float;
//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec3 LocalUv_TriangleIndex;
varying vec4 Rgba;
varying vec3 TriangleUvIndex;
varying float3 FragWorldPos;

uniform sampler2D	NoiseImage;
uniform float Time;
uniform float Water_TimeScale;
uniform float Water_PosScale;
uniform float Water_HeightScale;
uniform float Water_SidewaysScalar;

uniform float Wave1_Amplitude;
uniform float Wave1_Frequency;
uniform float Wave1_DirX;
uniform float Wave1_DirZ;
uniform float Wave1_Phase;
uniform float Wave1_Sharpness;

uniform float Wave2_Amplitude;
uniform float Wave2_Frequency;
uniform float Wave2_DirX;
uniform float Wave2_DirZ;
uniform float Wave2_Phase;
uniform float Wave2_Sharpness;

uniform float Wave3_Amplitude;
uniform float Wave3_Frequency;
uniform float Wave3_DirX;
uniform float Wave3_DirZ;
uniform float Wave3_Phase;
uniform float Wave3_Sharpness;

uniform sampler2D OrigPositions;
uniform sampler2D WorldPositions;
uniform int WorldPositionsWidth;
uniform int WorldPositionsHeight;
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

//	https://github.com/djwhatle/glsl-water-sim/blob/master/assignment4/glslWater.vert
float wave_generate(float A, float D_x, float D_z, float f, float x, float z, float p, float t, float k)
{
	return A*pow((sin((D_x*x+D_z*z)*f+t*p)*0.5+0.5), k);
}

float3 GetWave1(float2 uv)
{
	float time = Time * Water_TimeScale;
	float amplitude = Wave1_Amplitude;
	float frequency = Wave1_Frequency;
	float direction_x = Wave1_DirX;
	float direction_z = Wave1_DirZ;
	float phase = Wave1_Phase;
	float sharpness = Wave1_Sharpness;
	float sine_result_1 = wave_generate( amplitude, direction_x, direction_z, frequency, uv.x, uv.y, phase, time, sharpness);

	float2 Sideways = normalize( float2(direction_x, direction_z) );
	Sideways *= Water_SidewaysScalar;
	Sideways *= texture2D( NoiseImage, uv ).xy;

	float3 xyz = float3( Sideways.x, 1.0, Sideways.y );
	return xyz * sine_result_1;
}

float3 GetWave2(float2 uv)
{
	float time = Time * Water_TimeScale;
	float amplitude = Wave2_Amplitude;
	float frequency = Wave2_Frequency;
	float direction_x = Wave2_DirX;
	float direction_z = Wave2_DirZ;
	float phase = Wave2_Phase;
	float sharpness = Wave2_Sharpness;
	float sine_result_2 = wave_generate( amplitude, direction_x, direction_z, frequency, uv.x, uv.y, phase, time, sharpness);

	float2 Sideways = normalize( float2(direction_x, direction_z) );
	Sideways *= Water_SidewaysScalar;
	Sideways *= texture2D( NoiseImage, uv ).yz;
	
	float3 xyz = float3( Sideways.x, 1.0, Sideways.y );
	return xyz * sine_result_2;
}


float3 GetWave3(float2 uv)
{
	float time = Time * Water_TimeScale;
	float amplitude = Wave3_Amplitude;
	float frequency = Wave3_Frequency;
	float direction_x = Wave3_DirX;
	float direction_z = Wave3_DirZ;
	float phase = Wave3_Phase;
	float sharpness = Wave3_Sharpness;
	float sine_result_2 = wave_generate( amplitude, direction_x, direction_z, frequency, uv.x, uv.y, phase, time, sharpness);
	
	float2 Sideways = normalize( float2(direction_x, direction_z) );
	Sideways *= Water_SidewaysScalar;
	Sideways *= texture2D( NoiseImage, uv ).xz;
	
	float3 xyz = float3( Sideways.x, 1.0, Sideways.y );
	return xyz * sine_result_2;
}

float3 GetWaterNoiseOffset(float2 Mapuv)
{
	float Lod = 0.0;
	
	float SpaceScalar = Water_PosScale;
	float3 Noise;
	Noise += GetWave1(Mapuv * float2(SpaceScalar,SpaceScalar));
	Noise += GetWave2(Mapuv * float2(SpaceScalar,SpaceScalar));
	Noise += GetWave3(Mapuv * float2(SpaceScalar,SpaceScalar));
	Noise *= Water_HeightScale;
	//Noise *= Noise;
	//Noise *= Noise;
	return Noise;
}


float3 GetScaledInput(float2 uv,sampler2D Texture,float2 ScalarMinMax)
{
	/*
	 if ( FirstUpdate )
	 return float3(0,0,0);
	 */
	float Lod = 0.0;
	vec4 Pos = textureLod( Texture, uv, Lod );
	if ( Pos.w != 1.0 )	//	our float textures have a pure 1.0 alpha, and dont want to be rescaled
	{
		Pos.xyz -= float3( 0.5, 0.5, 0.5 );
		Pos.xyz *= 2.0;
		Pos.xyz *= mix( ScalarMinMax.x, ScalarMinMax.y, Pos.w );
	}
	return Pos.xyz;
}

float3 GetInputOrigPosition(float2 uv)
{
	return GetScaledInput( uv, OrigPositions, OrigPositionScalarMinMax );
}

void GetTriangleWorldPosAndColour(float TriangleIndex,out float3 WorldPos,out float4 Colour)
{
	float2 uv = GetTriangleUvf( TriangleIndex );
	float Lod = 0.0;
	
	
#if defined(TEST_ONE_COLOUR)
	Colour = TEST_ONE_COLOUR;
#else
	float4 ColourImageColour = textureLod( ColourImage, uv, Lod );
	Colour = float4(ColourImageColour.xyz,1);
#endif
	

	float3 GridPos = GetInputOrigPosition( uv );
	//	for some reason, this doesn't give me y=0
	WorldPos = GridPos;
	//WorldPos.y = 0.0;
	//return;
	float2 NoiseUv = GridPos.xz;
	float3 WaterNoise = GetWaterNoiseOffset( NoiseUv );
	
	WorldPos += WaterNoise;
	//Colour = float4( GridPos.xz, 0, 1 );
	/*
	Colour = float4( NoiseUv, 0, 1 );
	if ( NoiseUv.x > 1.0 )
		Colour = float4( 0, 0, 1, 1 );
	*/
	
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
