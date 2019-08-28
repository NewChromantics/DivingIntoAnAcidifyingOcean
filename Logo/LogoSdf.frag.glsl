precision highp float;

uniform sampler2D Texture;
varying vec2 uv;
uniform float SdfMin;
uniform float SampleDelta;
uniform float ProjectionAspectRatio;

float opSmoothUnion( float d1, float d2, float k ) {
	float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
	return mix( d2, d1, h ) - k*h*(1.0-h);
	
}

float GetOffsetSample(float2 uv,float2 Offset)
{
	uv += Offset;
	uv.y = 1.0 - uv.y;
	float Sample = texture( Texture, uv ).z;
	return Sample;
}

//	http://dev.theomader.com/gaussian-kernel-calculator/
#define PushWeight(i,a)		Weights[i]=a;
#define PushRow(i,a,b,c,d,e)	PushWeight(i+0,a);	PushWeight(i+1,b);	PushWeight(i+2,c);	PushWeight(i+3,d);	PushWeight(i+4,e);


void GetKernelWeights_Sigma0(out float Weights[5*5])
{
	Weights[12] = 1.0;
}

void GetKernelWeights_Sigma1(out float Weights[5*5])
{
	PushRow( 0, 0.003765,	0.015019,	0.023792,	0.015019,	0.003765 );
	PushRow( 5, 0.015019,	0.059912,	0.094907,	0.059912,	0.015019 );
	PushRow( 10,0.023792,	0.094907,	0.150342,	0.094907,	0.023792 );
	PushRow( 15,0.015019,	0.059912,	0.094907,	0.059912,	0.015019 );
	PushRow( 20,0.003765,	0.015019,	0.023792,	0.015019,	0.003765 );
}

void GetKernelWeights_Sigma2(out float Weights[5*5])
{
	PushRow( 0, 0.023528,	0.033969,	0.038393,	0.033969,	0.023528 );
	PushRow( 5, 0.033969,	0.049045,	0.055432,	0.049045,	0.033969 );
	PushRow( 10,0.038393,	0.055432,	0.062651,	0.055432,	0.038393 );
	PushRow( 15,0.033969,	0.049045,	0.055432,	0.049045,	0.033969 );
	PushRow( 20,0.023528,	0.033969,	0.038393,	0.033969,	0.023528 );
}

void GetKernelWeights_Sigma3(out float Weights[5*5])
{
	PushRow( 0, 0.031827,	0.037541,	0.039665,	0.037541,	0.031827 );
	PushRow( 5, 0.037541,	0.044281,	0.046787,	0.044281,	0.037541 );
	PushRow( 10,0.039665,	0.046787,	0.049434,	0.046787,	0.039665 );
	PushRow( 15,0.037541,	0.044281,	0.046787,	0.044281,	0.037541 );
	PushRow( 20,0.031827,	0.037541,	0.039665,	0.037541,	0.031827 );
}

void GetKernelWeights_Sigma4(out float Weights[5*5])
{
	PushRow( 0, 0.035228,	0.038671,	0.039892,	0.038671,	0.035228 );
	PushRow( 5, 0.038671,	0.042452,	0.043792,	0.042452,	0.038671 );
	PushRow( 10,0.039892,	0.043792,	0.045175,	0.043792,	0.039892 );
	PushRow( 15,0.038671,	0.042452,	0.043792,	0.042452,	0.038671 );
	PushRow( 20,0.035228,	0.038671,	0.039892,	0.038671,	0.035228 );
}


void GetKernelWeights_Average(out float Weights[5*5])
{
	for ( int i=0;	i<5*5;	i++ )
	{
		Weights[i] = 1.0 / (5.0*5.0);
	}
}

uniform int SampleWeightSigma;

float GetSample(float2 uv)
{
	//	multi sample
	float2 Delta = float2( SampleDelta, SampleDelta / ProjectionAspectRatio );
	
	float Weights[5*5];
	if ( SampleWeightSigma == 0 )		GetKernelWeights_Sigma0(Weights);
	else if ( SampleWeightSigma == 1 )	GetKernelWeights_Sigma1(Weights);
	else if ( SampleWeightSigma == 2 )	GetKernelWeights_Sigma2(Weights);
	else if ( SampleWeightSigma == 3 )	GetKernelWeights_Sigma3(Weights);
	else if ( SampleWeightSigma == 4 )	GetKernelWeights_Sigma4(Weights);
	else								GetKernelWeights_Average(Weights);
	
	float Sample = 0.0;
	for ( int w=0;	w<5*5;	w++ )
	{
		float x = mod( float(w), 5.0 );
		float y = float( w / 5 );
		x = floor(x);
		y = floor(y);
		x /= 5.0;
		y /= 5.0;
		float Weight = Weights[w];
		//x = mix( -1.0, 1.0, x );
		//y = mix( -1.0, 1.0, y );
		float NewSample = GetOffsetSample( uv, Delta * float2(x,y) );
		Sample += NewSample * Weight;
	}
	return Sample;
}

void main()
{
	float Sample = GetSample( uv );

	if ( Sample >= SdfMin )
	{
		gl_FragColor = float4(1,1,1,1);
		return;
	}

	//Sample = opSmoothUnion( Sample, Sample, SdfMin );
/*
	if ( Sample < SdfMin )
		Sample = 0.0;
	else
		Sample = 1.0;
	*/
	gl_FragColor = float4( 0,0,0,1 );
}

