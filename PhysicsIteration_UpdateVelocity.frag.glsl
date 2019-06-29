precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform sampler2D Noise;
uniform float Step = 0;//1.0/60.0;
uniform float NoiseScale = 0.1;
uniform float Gravity = -0.1;

float3 GetNoise(float2 uv)
{
	vec4 Noise4 = texture( Noise, uv );
	Noise4 -= 0.5;
	Noise4 *= 2;
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
	
	Vel.xyz += GetNoise(uv) * Step;
	Vel.xyz += GetGravity(uv) * Step;
	
	gl_FragColor = Vel;
}


