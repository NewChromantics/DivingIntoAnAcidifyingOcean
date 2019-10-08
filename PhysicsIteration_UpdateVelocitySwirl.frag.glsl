precision highp float;

varying vec2 uv;
uniform sampler2D LastVelocitys;
uniform sampler2D OrigPositions;
uniform sampler2D LastPositions;
uniform float PositionCount;
uniform float2 OrigPositionsWidthHeight;

uniform float PhysicsStep;// = 1.0/60.0;
uniform float Damping;

uniform float SpringScale;// = 0.1;
uniform float MaxSpringForce;
uniform float SplineTime;
const float SlineTimeRange = 0.1;	//	+/-

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

float3 GetSpringTargetPos(float2 uv)
{
	//	retarget uv
	//	uv -> index
	//	index -> normal
	//	normal * time
	//	normal -> uv
	float Index = PositionUvToIndex( uv );
	float Normal = Index / PositionCount;

	//Normal += SplineTime;
	//Normal = fract(Normal);
	Normal = mix( SplineTime, SplineTime+SlineTimeRange, Normal );
	
	Index = Normal * PositionCount;
	uv = PositionIndexToUv( Index );
	
	return texture2D( OrigPositions, uv ).xyz;
}


float3 GetSpringForce(float2 uv)
{
	vec3 OrigPos = GetSpringTargetPos( uv );
	vec3 LastPos = texture2D( LastPositions, uv ).xyz;
	
	float3 Force = (OrigPos - LastPos) * SpringScale;
	float ForceMagnitude = length( Force );
	ForceMagnitude = min( MaxSpringForce, ForceMagnitude );
	Force = normalize( Force ) * ForceMagnitude;
	return Force;
}

void main()
{
	vec4 Vel = texture( LastVelocitys, uv );
	
	//Vel.xyz += GetNoise(uv) * PhysicsStep;
	Vel.xyz += GetSpringForce(uv) * PhysicsStep;
	
	//	damping
	Vel.xyz *= 1.0 - Damping;

	Vel.w = 1.0;
	gl_FragColor = Vel;
}


