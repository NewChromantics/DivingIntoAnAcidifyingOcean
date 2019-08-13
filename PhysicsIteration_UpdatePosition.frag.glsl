precision highp float;

varying vec2 uv;
uniform sampler2D LastPositions;
uniform sampler2D Velocitys;
uniform float PhysicsStep;//= 1.0/60.0;

void main()
{
	//	gr: this should make sure it's sample middle of texel
	vec4 Pos = texture2D( LastPositions, uv );
	vec4 Vel = texture2D( Velocitys, uv );
	Pos += Vel * PhysicsStep;
	Pos.w = 1.0;
	gl_FragColor = Pos;
}


