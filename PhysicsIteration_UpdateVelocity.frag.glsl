precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform sampler2D OrigPositions;

uniform sampler2D Noise;
uniform float PhysicsStep;// = 1.0/60.0;
uniform float NoiseScale;// = 0.1;
uniform float Gravity;// = -0.1;
uniform float Damping;


float3 GetNormal(float2 uv)
{
	vec3 Position = texture2D( OrigPositions, uv ).xyz;
	vec3 Normal = normalize( Position );
	return Position;
}

float3 GetNoise(float2 uv)
{
	float3 NoiseValue = texture2D( Noise, uv ).xyz;
	//	turn to -1..1 (amplitude needs to be 1 really)
	NoiseValue -= 0.5;
	NoiseValue *= 2.0;
	NoiseValue *= NoiseScale;
	return NoiseValue;
	
	float3 Normal = GetNormal(uv);
	Normal *= NoiseValue;
	return Normal;
	//	noise goes along normal
	//float3 Normal = float3(1,1,1);
	//return Normal;
}


float3 GetGravity(float2 uv)
{
	return float3(0,Gravity,0);
}

void main()
{
	//	gr: just a blit should be stable
	vec4 Vel = texture( LastVelocitys, uv );
	
	Vel.xyz += GetNoise(uv) * PhysicsStep;
	//Vel.xyz += GetNoise(uv) * PhysicsStep;
	//Vel.xyz += GetGravity(uv) * PhysicsStep;
	
	//	damping
	//Vel.xyz *= 1.0 - Damping;

	Vel.w = 1.0;
	gl_FragColor = Vel;
}


