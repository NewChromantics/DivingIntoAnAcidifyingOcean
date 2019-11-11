precision highp float;

varying vec2 uv;
uniform sampler2D LastPositions;
uniform sampler2D Velocitys;
uniform float PhysicsStep;//= 1.0/60.0;
uniform bool FirstUpdate;
const float ScalarMin = 0.2;
const float ScalarMax = 1.0;


float3 GetScaledInput(float2 uv,sampler2D Texture)
{
	if ( FirstUpdate )
		return float3(0,0,0);
	
	vec4 Pos = texture2D( Texture, uv );
	Pos.xyz -= float3( 0.5, 0.5, 0.5 );
	Pos.xyz *= 2.0;
	Pos.xyz *= mix( ScalarMin, ScalarMax, Pos.w );
	
	return Pos.xyz;
}

float Range(float Min,float Max,float Value)
{
	return (Value-Min) / (Max-Min);
}

float3 abs3(float3 xyz)
{
	return float3( abs(xyz.x), abs(xyz.y), abs(xyz.z) );
}


float4 GetScaledOutput(float3 Position)
{
	//	get the scalar, but remember, we are normalising to -0.5,,,0.5
	//	so it needs to double
	//	and then its still 0...1 so we need to multiply by an arbritry number I guess
	//	or 1/scalar
	float3 PosAbs = abs3(Position);
	float Big = max( ScalarMin, max( PosAbs.x, max( PosAbs.y, PosAbs.z ) ) );
	float Scalar = Range( ScalarMin, ScalarMax, Big );
	Position /= Big;
	Position /= 2.0;
	Position += float3( 0.5, 0.5, 0.5 );
	//Scalar = 0.5;
	//	reverse of
	//Pos.xyz -= float3( 0.5, 0.5, 0.5 );
	//Pos.xyz *= mix( 1.0, ScalarScalar, Pos.w );
	
	
	return float4( Position, Scalar );
}

void main()
{
	//	gr: this should make sure it's sample middle of texel
	vec3 Pos = GetScaledInput( uv, LastPositions );
	vec3 Vel = GetScaledInput( uv, Velocitys );
	Pos += Vel * PhysicsStep;
	//Pos += float3( 0,0.1, 0);
	
	gl_FragColor = GetScaledOutput( Pos );
}


