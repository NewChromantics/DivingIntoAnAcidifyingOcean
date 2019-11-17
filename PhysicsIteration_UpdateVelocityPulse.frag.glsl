precision highp float;

varying vec2 uv;
uniform sampler2D OrigPositions;
uniform sampler2D LastVelocitys;
uniform sampler2D LastPositions;
uniform sampler2D Noise;
uniform float PhysicsStep;// = 1.0/60.0;
uniform float NoiseScale;// = 0.1;
uniform float ExplodeScale;// = 0.1;
uniform float Gravity;// = -0.1;
uniform float Damping;
uniform float SpringScale;


uniform bool FirstUpdate;
const float2 PositionScalarMinMax = float2(0.1,2.0);
const float2 VelocityScalarMinMax = float2(0.005,0.5);
const float2 OrigPositionScalarMinMax = float2(0.0,1.0);



float3 GetScaledInput(float2 uv,sampler2D Texture,float2 ScalarMinMax)
{
	if ( FirstUpdate )
		return float3(0,0,0);
	
	vec4 Pos = texture2D( Texture, uv );
	if ( Pos.w != 1.0 )	//	our float textures have a pure 1.0 alpha, and dont want to be rescaled
	{
		Pos.xyz -= float3( 0.5, 0.5, 0.5 );
		Pos.xyz *= 2.0;
		Pos.xyz *= mix( ScalarMinMax.x, ScalarMinMax.y, Pos.w );
	}
	return Pos.xyz;
}


float3 GetInputOrigPosition(float2 uv)
{
	return GetScaledInput( uv, OrigPositions, OrigPositionScalarMinMax );
}

float3 GetSpringForce(float2 uv)
{
	vec3 OrigPos = GetInputOrigPosition( uv );
	
	float3 LastOffset = GetScaledInput( uv, LastPositions, PositionScalarMinMax );
	float3 LastPos = OrigPos + LastOffset;
	
	return (OrigPos - LastPos) * SpringScale;
}

float3 GetExplodeForce(float2 uv)
{
	//	noise for pulse is
	vec3 OrigPos = GetInputOrigPosition( uv );
	vec3 Explode = normalize( OrigPos );
	Explode *= ExplodeScale;
	return Explode;
}

float3 GetNoise(float2 uv)
{
	vec4 Noise4 = texture2D( Noise, uv );
	Noise4 -= 0.5;
	Noise4 *= 2.0;
	Noise4 *= NoiseScale;
	return Noise4.xyz;
}


float3 GetGravity(float2 uv)
{
	return float3(0,Gravity,0);
}



float3 GetInputVelocity(float2 uv)
{
	return GetScaledInput( uv, LastVelocitys, VelocityScalarMinMax );
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
	//	gr: just a blit should be stable
	float3 Velocity = GetInputVelocity(uv);
	
	Velocity += GetNoise(uv) * PhysicsStep;
	Velocity += GetGravity(uv) * PhysicsStep;
	Velocity += GetSpringForce(uv) ;//* PhysicsStep;
	Velocity += GetExplodeForce(uv) * PhysicsStep;

	//	damping
	Velocity *= 1.0 - Damping;

	gl_FragColor = GetScaledOutput( Velocity, VelocityScalarMinMax );
}


