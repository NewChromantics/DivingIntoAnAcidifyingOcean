precision highp float;
varying vec4 Rgba;
varying vec2 TriangleUv;
uniform float Radius = 0.5;

void main()
{
	float2 uv = TriangleUv;
	float Distance = length( uv );
	if ( Distance > Radius )
		discard;
	gl_FragColor = Rgba;
}
