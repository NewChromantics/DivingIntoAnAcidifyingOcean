precision highp float;

varying vec2 uv;
uniform sampler2D LastPositions;
uniform sampler2D Velocitys;
uniform float Step = 1.0/60.0;

void main()
{
	//	gr: this should make sure it's sample middle of texel
	vec4 Pos = texture( LastPositions, uv );
	vec4 Vel = texture( Velocitys, uv );
	Pos += Vel * Step;
	gl_FragColor = Pos;
}


