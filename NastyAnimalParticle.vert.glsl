precision highp float;
//#extension GL_EXT_shader_texture_lod : require
//#extension GL_OES_standard_derivatives : require

attribute vec3 LocalUv_TriangleIndex;
varying vec4 Rgba;
varying vec3 TriangleUvIndex;
varying float3 FragWorldPos;
varying vec2 ParticleMapUv;

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

uniform float Time;
uniform float TriangleScale;// = 0.06;
uniform float TriangleScaleMax;
uniform float TriangleScale_Duration;

uniform sampler2D Velocitys;
uniform sampler2D NoiseTexture;

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


vec3 GetTriangleWorldPos(int TriangleIndex)
{
	float2 uv = GetTriangleUv( TriangleIndex );
	float Lod = 0.0;
	float3 xyz = textureLod( WorldPositions, uv, Lod ).xyz;
	return xyz;
}

void GetTriangleWorldPosAndColour(float TriangleIndex,out float3 WorldPos,out float4 Colour)
{
	float2 uv = GetTriangleUvf( TriangleIndex );
	float Lod = 0.0;
	WorldPos = textureLod( WorldPositions, uv, Lod ).xyz;
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

float Range(float Min,float Max,float Time)
{
	return (Time-Min) / (Max-Min);
}

float RangePingPong(float Min,float Max,float Time)
{
	float TimeNorm = Range( Min, Max, Time );
	TimeNorm = fract( TimeNorm );
	//	we can do this without an if!
	if ( TimeNorm > 0.5 )
	{
		TimeNorm = (TimeNorm - 0.5);
		TimeNorm /= 0.5;
		TimeNorm = 1.0 - TimeNorm;
	}
	else
	{
		TimeNorm /= 0.5;
	}
	return TimeNorm;
}

float GetTriangleScaleNorm(float TriangleIndexf)
{
	//	get a random time offset
	TriangleIndexf /= float(TriangleCount);
	float2 Noiseuv = float2( TriangleIndexf, 0 );
	float TimeOffset = texture2D( NoiseTexture, Noiseuv ).x;
	float TimeOffset2 = texture2D( NoiseTexture, Noiseuv ).y;

	//	slowly scale up initially, this creates a global glow, but stops things suddenly being big
	float DurationOffset = 1.0 + TimeOffset2;
	float TimeOffsetScale = min( 1.0, Range( 0.0, TriangleScale_Duration*DurationOffset, Time ) );
	TimeOffset *= TimeOffsetScale;
	
	float ScaleTime = max( 1.0, Time-TimeOffset );
	
	float ScaleLerp = RangePingPong( 0.0, TriangleScale_Duration, ScaleTime );
	return ScaleLerp;
}

void main_BillBoardCameraSpace()
{
	float TriangleIndexf = LocalUv_TriangleIndex.z;

	float TriangleScaleMixed = mix( TriangleScale, TriangleScaleMax, GetTriangleScaleNorm(TriangleIndexf) );

	float3 TriangleWorldPos;
	GetTriangleWorldPosAndColour( TriangleIndexf, TriangleWorldPos, Rgba );
	
	float2 Localuv = LocalUv_TriangleIndex.xy;

	float4 WorldPos = LocalToWorldTransform * float4(TriangleWorldPos,1);
	float4 CameraPos = WorldToCameraTransform * WorldPos;

	float2 VertexPos = Localuv * TriangleScaleMixed;
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
	ParticleMapUv = GetTriangleUvf( TriangleIndexf );
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
