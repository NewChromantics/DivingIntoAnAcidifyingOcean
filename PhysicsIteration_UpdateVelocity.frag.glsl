precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform sampler2D Noise;
uniform float PhysicsStep = 1.0/60.0;
uniform float NoiseScale = 0.1;
uniform float Gravity = -0.1;


/*
float3 fade(float3 t)
{	return t * t * t * (t * (t * 6 - 15) + 10);	}

//4D
float4 fade(float4 t)
{	return t * t * t * (t * (t * 6 - 15) + 10);	}

float perm(float x)
{	return permTexture.SampleLevel(PerlinPointWrapSampler,float2(x,0),0).x;	}

float4 perm2d(float2 p)
{	return permTexture2d.SampleLevel(PerlinPointWrapSampler,p,0);	}

//3D
float gradperm(float x, float3 p)
{	float4 val = permGradTexture.SampleLevel(PerlinPointWrapSampler,float2(x,0),0);
	return dot(val.xyz*2.0f-1.0f, p);	}

//4D
float grad(float x, float4 p)
{	float4 val = gradTexture4d.SampleLevel(PerlinPointWrapSampler,float2(x,0),0);
	return dot(val*2.0f-1.0f, p);	}

// 3D noise
float inoise(float3 p)
{
	//p += 1000;
	float fOne = 1.0 / 256.0;
	
	float3 P = fmod(floor(p), 256.0);	// FIND UNIT CUBE THAT CONTAINS POINT
	p -= floor(p);                      // FIND RELATIVE X,Y,Z OF POINT IN CUBE.
	float3 f = fade(p);                 // COMPUTE FADE CURVES FOR EACH OF X,Y,Z.
	
	P = P * fOne;
	
	// HASH COORDINATES OF THE 8 CUBE CORNERS
	float4 AA = perm2d(P.xy) + P.z;
	
	// AND ADD BLENDED RESULTS FROM 8 CORNERS OF CUBE
	return lerp( lerp( lerp( gradperm(AA.x, p ),
							gradperm(AA.z, p + float3(-1, 0, 0) ), f.x),
					  lerp( gradperm(AA.y, p + float3(0, -1, 0) ),
						   gradperm(AA.w, p + float3(-1, -1, 0) ), f.x), f.y),
				
				lerp( lerp( gradperm(AA.x+fOne, p + float3(0, 0, -1) ),
						   gradperm(AA.z+fOne, p + float3(-1, 0, -1) ), f.x),
					 lerp( gradperm(AA.y+fOne, p + float3(0, -1, -1) ),
						  gradperm(AA.w+fOne, p + float3(-1, -1, -1) ), f.x), f.y), f.z);
}

//	https://github.com/letmp/dx11-particles/blob/065a596edfa02f65091fd2c83b275b174605c019/packs/dx11.particles/nodes/modules/Modifiers/fxh/NoiseFunctions.fxh
//	gr: ^^ says perlin, we have better perlin routines. pregen it!
float fBm(float3 p, int oct, float freq, float lacun, float pers)
{
	float sum = 0;
	float amp = 0.5;
	
	for(int i=0; i <= oct; i++) {
		sum += inoise(p*freq)*amp;
		freq *= lacun;
		amp *= pers;
	}
	return sum;
}

//	https://github.com/letmp/dx11-particles/blob/065a596edfa02f65091fd2c83b275b174605c019/packs/dx11.particles/nodes/modules/Modifiers/dx11/Modifier_Turbulence.fx
//	https://github.com/letmp/dx11-particles/blob/065a596edfa02f65091fd2c83b275b174605c019/packs/dx11.particles/nodes/modules/Modifiers/fxh/NoiseFunctions.fxh
float3 GetTurbulenceNoise()
{
	 uint size, stride;
	 NoiseAmountBuffer.GetDimensions(size,stride);
	 float3 noiseAmount = NoiseAmountBuffer[GetDynamicBufferIndex( particleIndex, input.DTID.x , size)];
	 NoiseTimeBuffer.GetDimensions(size,stride);
	 float noiseTime = NoiseTimeBuffer[GetDynamicBufferIndex( particleIndex, input.DTID.x , size)];
	 NoiseOctBuffer.GetDimensions(size,stride);
	 int noiseOct = NoiseOctBuffer[GetDynamicBufferIndex( particleIndex, input.DTID.x , size)];
	 NoiseFreqBuffer.GetDimensions(size,stride);
	 float noiseFreq = NoiseFreqBuffer[GetDynamicBufferIndex( particleIndex, input.DTID.x , size)];
	 NoiseLacunBuffer.GetDimensions(size,stride);
	 float noiseLacun = NoiseLacunBuffer[GetDynamicBufferIndex( particleIndex, input.DTID.x , size)];
	 NoisePersBuffer.GetDimensions(size,stride);
	 float noisePers = NoisePersBuffer[GetDynamicBufferIndex( particleIndex, input.DTID.x , size)];
	 
	 // Noise Force
	 float3 noiseForce = float3(
	 fBm(float4( position + float3(51,2.36,-5),noiseTime),noiseOct,noiseFreq,noiseLacun,noisePers),
	 fBm(float4( position + float3(98.2,-9,-36),noiseTime),noiseOct,noiseFreq,noiseLacun,noisePers),
	 fBm(float4( position + float3(0,10.69,6),noiseTime),noiseOct,noiseFreq,noiseLacun,noisePers)
	 );
	 noiseForce *= noiseAmount;

}
*/

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
	
	Vel.xyz += GetNoise(uv) * PhysicsStep;
	Vel.xyz += GetGravity(uv) * PhysicsStep;
	
	gl_FragColor = Vel;
}


