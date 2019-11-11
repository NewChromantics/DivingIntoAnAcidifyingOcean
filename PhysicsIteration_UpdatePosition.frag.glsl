precision highp float;

varying vec2 uv;
uniform sampler2D LastPositions;
uniform sampler2D Velocitys;
uniform float PhysicsStep;//= 1.0/60.0;
uniform bool FirstUpdate;
const float2 PositionScalarMinMax = float2(0.1,2.0);
const float2 VelocityScalarMinMax = float2(0.005,0.5);


float3 GetScaledInput(float2 uv,sampler2D Texture,float2 ScalarMinMax)
{
	if ( FirstUpdate )
		return float3(0,0,0);
	
	vec4 Pos = texture2D( Texture, uv );
	Pos.xyz -= float3( 0.5, 0.5, 0.5 );
	Pos.xyz *= 2.0;
	Pos.xyz *= mix( ScalarMinMax.x, ScalarMinMax.y, Pos.w );
	
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


float4 GetScaledOutput(float3 Position,float2 ScalarMinMax)
{
	//	get the scalar, but remember, we are normalising to -0.5,,,0.5
	//	so it needs to double
	//	and then its still 0...1 so we need to multiply by an arbritry number I guess
	//	or 1/scalar
	float3 PosAbs = abs3(Position);
	float Big = max( ScalarMinMax.x, max( PosAbs.x, max( PosAbs.y, PosAbs.z ) ) );
	float Scalar = Range( ScalarMinMax.x, ScalarMinMax.y, Big );
	Position /= Big;
	Position /= 2.0;
	Position += float3( 0.5, 0.5, 0.5 );
	
	return float4( Position, Scalar );
}

void main()
{
	//	gr: this should make sure it's sample middle of texel
	vec3 Pos = GetScaledInput( uv, LastPositions, PositionScalarMinMax );
	vec3 Vel = GetScaledInput( uv, Velocitys, VelocityScalarMinMax );
	Pos += Vel * PhysicsStep;
	//Pos += float3( 0,0.1, 0);
	
	gl_FragColor = GetScaledOutput( Pos, PositionScalarMinMax );
}


