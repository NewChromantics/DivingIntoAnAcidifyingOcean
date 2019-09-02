precision highp float;
varying vec4 Rgba;
varying vec2 TriangleUv;

const float CircleRadius = 0.5;

void main()
{
	/*
	if ( length(TriangleUv) > CircleRadius )
		discard;
	*/
	//	gr: for some reason, this is faster than using a constant!
	gl_FragColor = Rgba;
}

