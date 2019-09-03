precision highp float;
varying vec4 Rgba;
varying vec2 TriangleUv;

const float CircleRadius = 0.5;

uniform bool ColourImageValid;

void main()
{
	if ( length(TriangleUv) > CircleRadius )
		discard;

	//	gr: for some reason, this is faster than using a constant!
	gl_FragColor = Rgba;

	if ( !ColourImageValid )
		gl_FragColor = float4(0,1,0,1);
}

