precision highp float;
varying vec2 TriangleUv;

const float ClipRadius = 0.4;

void main()
{
	if ( length(TriangleUv) > ClipRadius )
		discard;
	gl_FragColor = float4(TriangleUv,1,1);
}

