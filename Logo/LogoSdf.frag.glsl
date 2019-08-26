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

float GetSample(float2 uv)
{
	//	multi sample
	float2 Delta = float2( SampleDelta, SampleDelta / ProjectionAspectRatio );
	
	float Sample = 0.0;
	float SampleCount = 0.0;
	for ( float x=-1.0;	x<=1.0;	x+=0.25 )
	{
		for ( float y=-1.0;	y<=1.0;	y+=0.25 )
		{
			float NewSample = GetOffsetSample( uv, Delta * float2(x,y) );
			Sample += NewSample;
			SampleCount += 1.0;
		}
	}
	Sample /= SampleCount;
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

