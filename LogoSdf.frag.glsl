precision highp float;

uniform sampler2D Texture;
varying vec2 uv;
uniform float SdfMin;

float opSmoothUnion( float d1, float d2, float k ) {
	float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
	return mix( d2, d1, h ) - k*h*(1.0-h);
	
}

void main()
{
	float4 Sample4 = texture( Texture, float2(uv.x,1.0-uv.y) );
	//float2 Delta = texture( Texture, float2(uv.x,1.0-uv.y) ).xy;
	float Sample = length(Sample4.z);

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
	gl_FragColor = float4( Sample4 );
}

