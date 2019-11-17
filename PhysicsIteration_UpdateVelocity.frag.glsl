precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform sampler2D OrigPositions;
uniform float3 OrigPositionsBoundingBox[2];
uniform bool FirstUpdate;
const float2 PositionScalarMinMax = float2(0.1,2.0);
const float2 VelocityScalarMinMax = float2(0.005,0.5);
const float2 OrigPositionScalarMinMax = float2(0.0,1.0);

uniform sampler2D Noise;
uniform float PhysicsStep;// = 1.0/60.0;
uniform float NoiseScale;// = 0.1;
uniform float Gravity;// = -0.1;
uniform float Damping;
uniform float TinyNoiseScale;

float Range(float Min,float Max,float Value)
{
	return (Value-Min) / (Max-Min);
}

float3 Range3(float3 Min,float3 Max,float3 Value)
{
	float x = Range( Min.x, Max.x, Value.x );
	float y = Range( Min.y, Max.y, Value.y );
	float z = Range( Min.z, Max.z, Value.z );
	return float3(x,y,z);
}


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

float3 GetNormal(float2 uv)
{
	vec3 Position = GetInputOrigPosition( uv );

	vec3 PositionNorm = Range3( OrigPositionsBoundingBox[0], OrigPositionsBoundingBox[1], Position );
	return PositionNorm;
}

float3 GetNoise(float2 uv)
{
	//	sample from the noise texture in a
	float3 Normal = GetNormal(uv);
	float2 Sampleuv = Normal.xy;
	Sampleuv *= Normal.z * 0.5;
	
	float3 NoiseValue = texture2D( Noise, Sampleuv ).xyz;
	//	turn to -1..1 (amplitude needs to be 1 really)
	NoiseValue -= 0.5;
	NoiseValue *= 2.0;
	NoiseValue *= NoiseScale;
	
	//	plus some extra tiny noise
	float3 TinyNoise = texture2D( Noise, uv ).xyz;
	//	turn to -1..1 (amplitude needs to be 1 really)
	TinyNoise -= 0.5;
	TinyNoise *= TinyNoiseScale;
	
	NoiseValue += TinyNoise;
	
	return NoiseValue;
}


float3 GetGravity(float2 uv)
{
	return float3(0,Gravity,0);
}


float3 GetInputVelocity(float2 uv)
{
	return GetScaledInput( uv, LastVelocitys, VelocityScalarMinMax );
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
	float3 Velocity = GetInputVelocity(uv);
	
	Velocity += GetNoise(uv) * PhysicsStep;
	//Velocity += GetNoise(uv) * PhysicsStep;
	//Velocity += GetGravity(uv) * PhysicsStep;
	
	//	damping
	Velocity *= 1.0 - Damping;

	gl_FragColor = GetScaledOutput( Velocity, VelocityScalarMinMax );
}


