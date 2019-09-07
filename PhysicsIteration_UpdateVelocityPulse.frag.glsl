precision highp float;

varying vec2 uv;
uniform sampler2D OrigPositions;
uniform sampler2D LastVelocitys;
uniform sampler2D LastPositions;
uniform sampler2D Noise;
uniform float PhysicsStep;// = 1.0/60.0;
uniform float NoiseScale;// = 0.1;
uniform float ExplodeScale;// = 0.1;
uniform float Gravity;// = -0.1;
uniform float Damping;
uniform float SpringScale;


float3 GetSpringForce(float2 uv)
{
	vec3 OrigPos = texture2D( OrigPositions, uv ).xyz;
	vec3 LastPos = texture2D( LastPositions, uv ).xyz;
	return (OrigPos - LastPos) * SpringScale;
}

float3 GetExplodeForce(float2 uv)
{
	//	noise for pulse is
	vec3 OrigPos = texture2D( OrigPositions, uv ).xyz;
	vec3 Explode = normalize( OrigPos );
	Explode *= ExplodeScale;
	return Explode;
}

float3 GetNoise(float2 uv)
{
	vec4 Noise4 = texture2D( Noise, uv );
	Noise4 -= 0.5;
	Noise4 *= 2.0;
	Noise4 *= NoiseScale;
	return Noise4.xyz;
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
	Vel.xyz += GetGravity(uv) * PhysicsStep;
	Vel.xyz += GetSpringForce(uv) ;//* PhysicsStep;
	Vel.xyz += GetExplodeForce(uv) * PhysicsStep;

	//	damping
	Vel.xyz *= 1.0 - Damping;

	Vel.w = 1.0;
	gl_FragColor = Vel;
}


