precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform sampler2D OrigPositions;
uniform float3 OrigPositionsBoundingBox[2];

uniform sampler2D Noise;
uniform float PhysicsStep;// = 1.0/60.0;
uniform float NoiseScale;// = 0.1;
uniform float Gravity;// = -0.1;
uniform float Damping;
uniform float TinyNoiseScale;

float Range(float Min,float Max,float Value)
{
	return (Value-Min) / (Max-Min);
}

float3 Range3(float3 Min,float3 Max,float3 Value)
{
	float x = Range( Min.x, Max.x, Value.x );
	float y = Range( Min.y, Max.y, Value.y );
	float z = Range( Min.z, Max.z, Value.z );
	return float3(x,y,z);
}

float3 GetNormal(float2 uv)
{
	vec3 Position = texture2D( OrigPositions, uv ).xyz;

	vec3 PositionNorm = Range3( OrigPositionsBoundingBox[0], OrigPositionsBoundingBox[1], Position );
	return PositionNorm;
}

float3 GetNoise(float2 uv)
{
	//	sample from the noise texture in a
	float3 Normal = GetNormal(uv);
	float2 Sampleuv = Normal.xy;
	Sampleuv *= Normal.z * 0.5;
	
	float3 NoiseValue = texture2D( Noise, Sampleuv ).xyz;
	//	turn to -1..1 (amplitude needs to be 1 really)
	NoiseValue -= 0.5;
	NoiseValue *= 2.0;
	NoiseValue *= NoiseScale;
	
	//	plus some extra tiny noise
	float3 TinyNoise = texture2D( Noise, uv ).xyz;
	//	turn to -1..1 (amplitude needs to be 1 really)
	TinyNoise -= 0.5;
	TinyNoise *= TinyNoiseScale;
	
	NoiseValue += TinyNoise;
	
	return NoiseValue;
}


float3 GetGravity(float2 uv)
{
	return float3(0,Gravity,0);
}

float3 GetInputVelocity(float2 uv)
{
	//	gr: just a blit should be stable
	vec4 Vel = texture( LastVelocitys, uv );
	
	//	todo: use w as scalar
	Vel.xyz -= float3( 0.5, 0.5, 0.5 );

	return Vel.xyz;
}

float4 GetOutputVelocity(float3 Velocity)
{
	Velocity += float3( 0.5, 0.5, 0.5 );
	return float4( Velocity, 1.0 );
}

void main()
{
	float3 Velocity = GetInputVelocity(uv);
	
	Velocity += GetNoise(uv) * PhysicsStep;
	//Velocity += GetNoise(uv) * PhysicsStep;
	//Velocity += GetGravity(uv) * PhysicsStep;
	
	//	damping
	Velocity *= 1.0 - Damping;

	gl_FragColor = GetOutputVelocity( Velocity );
}


