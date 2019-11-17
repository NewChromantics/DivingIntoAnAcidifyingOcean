precision highp float;

varying vec2 uv;
uniform sampler2D LastPositions;
uniform sampler2D Velocitys;
uniform sampler2D OrigPositions;
uniform float PositionCount;
uniform float2 OrigPositionsWidthHeight;

uniform sampler2D Noise;

uniform float PhysicsStep;// = 1.0/60.0;
uniform float Damping;

uniform float LocalNoiseScale;
uniform float SplineNoiseScale;

uniform float SpringScale;// = 0.1;
uniform float MaxSpringForce;
uniform float SplineTime;
uniform float SplineTimeRange;
uniform float StringStrips;

uniform bool FirstUpdate;
const float2 PositionScalarMinMax = float2(0.1,2.0);
const float2 VelocityScalarMinMax = float2(0.005,0.5);
const float2 OrigPositionScalarMinMax = float2(0.0,1.0);


uniform float3 AvoidRayStart;
uniform float3 AvoidRayDirection;
uniform float AvoidRayRadius;
uniform float AvoidRayScale;



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

float PositionUvToIndex(float2 uv)
{
	//	gr: does this work with an arbirtry number?
	float2 Size = OrigPositionsWidthHeight;
	uv = floor( uv * Size );
	float Index = uv.y * Size.x;
	Index += uv.x;
	return Index;
}

float2 PositionIndexToUv(float TriangleIndex)
{
	float Widthf = OrigPositionsWidthHeight.x;
	float WidthInv = 1.0 / Widthf;
	float t = TriangleIndex;
	
	//	index->uv
	float x = mod( t, Widthf );
	float y = (t-x) * WidthInv;
	float u = x * WidthInv;
	float v = y / OrigPositionsWidthHeight.y;
	
	float2 uv = float2(u,v);
	return uv;
}

float2 GetNoiseUv(float2 uv)
{
	//	put gaps in the noise
	float x = uv.x;
	float Strips = max( 1.0, StringStrips );
	x *= Strips;
	//	shrink remainder
	float Frac = fract( x ) * 0.1;
	x = floor( x ) + Frac;
	
	//	scale back down again
	x /= Strips;
	
	return float2( x, uv.y );
}


float2 GetNoiseUvFromIndex(float IndexNormal)
{
	//	Index normal is 0-1 along spline (1 further along length)
	//	we want length-wise strips, so split inside chunks, instead of by-chunk
	float Strips = max( 1.0, StringStrips );
	
	float Index = IndexNormal * PositionCount;
	float Row = floor( mod( Index, Strips ) ) / Strips;
	float Col = IndexNormal;
	
	return float2( Col, Row );
}

float Clamp01(float Value)
{
	return max( 0.0, min( 0.99, Value ) );
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


float3 GetSpringTargetPos(float2 uv)
{
	//	retarget uv
	//	uv -> index
	//	index -> normal
	//	normal * time
	//	normal -> uv
	float Index = PositionUvToIndex( uv );
	float Normal = Index / PositionCount;
	
	//	we now have 0-1 for us
	//	find a position along the spline
	float SplineMin = Clamp01( SplineTime-SplineTimeRange );
	float SplineMax = Clamp01( SplineTime );
	float SplineSampleTime = mix( SplineMin, SplineMax, Normal );
	
	float2 SplinePosUv = PositionIndexToUv( SplineSampleTime * PositionCount );
	float3 SplinePos = GetInputOrigPosition( SplinePosUv );
	
	//	get noise related to our spline position to make divergence from the path as strips
	float2 SplineNoiseUv = GetNoiseUvFromIndex( Normal );
	float3 SplineNoise = texture2D( Noise, SplineNoiseUv ).xyz;
	float3 SplineNoiseScale3 = float3(SplineNoiseScale,SplineNoiseScale,SplineNoiseScale) * 0.5;
	SplineNoise = mix( -SplineNoiseScale3, SplineNoiseScale3, SplineNoise );
	SplinePos += SplineNoise;
	
	//	additional noise which when using perlin/flowy noise spreads them out into ribbons
	float3 LocalNoise = texture2D( Noise, uv ).xyz;
	float3 LocalNoiseScale3 = float3(LocalNoiseScale,LocalNoiseScale,LocalNoiseScale) * 0.5;
	LocalNoise = mix( -LocalNoiseScale3, LocalNoiseScale3, LocalNoise );
	SplinePos += LocalNoise;
	
	return SplinePos;
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
	
	//if ( FirstUpdate )
		Pos = GetSpringTargetPos(uv);
	Pos = float3(0,0,0);
	gl_FragColor = GetScaledOutput( Pos, PositionScalarMinMax );
}


