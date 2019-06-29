precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform float Step = 1.0/60.0;

void main()
{
	//	gr: just a blit should be stable
	vec4 Vel = texture( LastVelocitys, uv );
	Vel.y += 0.1 * Step;
	gl_FragColor = Vel;
}


