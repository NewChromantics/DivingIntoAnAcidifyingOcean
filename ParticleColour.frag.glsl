precision highp float;
varying vec4 Rgba;
varying vec2 TriangleUv;
uniform float Radius = 0.5;
varying vec3 FragWorldPos;
varying vec4 Sphere4;	//	the shape rendered by this triangle in world space

uniform vec3 CameraWorldPosition;

uniform float Fog_MinDistance = 0;
uniform float Fog_MaxDistance = 20;
uniform float3 Fog_Colour = float3(0,1,0);


float Range(float Min,float Max,float Value)
{
	return (Value-Min) / (Max-Min);
}

float RangeClamped01(float Min,float Max,float Value)
{
	float t = Range( Min, Max, Value );
	t = clamp( t, 0, 1 );
	return t;
}


float3 Range3(float3 Min,float3 Max,float3 Value)
{
	float x = Range(Min.x,Max.x,Value.x);
	float y = Range(Min.y,Max.y,Value.y);
	float z = Range(Min.z,Max.z,Value.z);
	return float3(x,y,z);
}

float3 slerp(float3 start, float3 end, float percent)
{
	// Dot product - the cosine of the angle between 2 vectors.
	float dotprod = dot(start, end);
	// Clamp it to be in the range of Acos()
	// This may be unnecessary, but floating point
	// precision can be a fickle mistress.
	dotprod = clamp(dotprod, -1.0, 1.0);
	// Acos(dot) returns the angle between start and end,
	// And multiplying that by percent returns the angle between
	// start and the final result.
	float theta = acos(dotprod)*percent;
	float3 RelativeVec = normalize(end - start*dotprod); // Orthonormal basis
	// The final result.
	return ((start*cos(theta)) + (RelativeVec*sin(theta)));
}


//	returns normal & distance
float4 GetCameraIntersection(float3 WorldPos,float4 Sphere)
{
	//	get ray
	float3 DirToCamera = -normalize(WorldPos - CameraWorldPosition);
	
	float3 SdfNormal = ((WorldPos - Sphere.xyz) / Sphere.w);
	//SdfNormal = normalize( slerp( SdfNormal, DirToCamera, 1-length(SdfNormal) ) );
	SdfNormal = slerp( SdfNormal, DirToCamera, 1-length(SdfNormal) );
	SdfNormal = normalize( SdfNormal );
	//	intersection
	float3 RealWorldPos = WorldPos + (SdfNormal*Sphere.w);
	
	float SdfDistance = distance( WorldPos, Sphere.xyz );

	return float4( SdfNormal, SdfDistance );
}


float3 NormalToRedGreen(float Normal)
{
	if ( Normal < 0 )
	{
		return float3( 1,0,1 );
	}
	else if ( Normal < 0.5 )
	{
		Normal = Normal / 0.5;
		return float3( 1, Normal, 0 );
	}
	else if ( Normal <= 1 )
	{
		Normal = (Normal-0.5) / 0.5;
		return float3( 1-Normal, 1, 0 );
	}
	
	//	>1
	return float3( 0,0,1 );
}

float3 ApplyFog(vec3 Rgb,vec3 WorldPos)
{
	float FogDistance = length( CameraWorldPosition - WorldPos );
	float FogStrength = RangeClamped01( Fog_MinDistance, Fog_MaxDistance, FogDistance );
	Rgb = mix( Rgb, Fog_Colour, FogStrength );
	//Rgb = NormalToRedGreen(FogStrength);
	

	return Rgb;
}

void main()
{	
	//	do 3D test
	float4 Intersection = GetCameraIntersection(FragWorldPos,Sphere4);
	if ( Intersection.w > Sphere4.w )
		discard;
	
	//	normal in visible range
	float3 Normal = Range3( float3(-1,-1,-1), float3(1,1,1), Intersection.xyz );
	
	//	draw normal
	gl_FragColor.xyz = mix( Normal, Rgba.xyz, 0.7 );
	gl_FragColor.xyz = ApplyFog( gl_FragColor.xyz, FragWorldPos );
	gl_FragColor.w = 1;

	//gl_FragColor = Rgba;
/*
	
	float2 uv = TriangleUv;
	float Distance = length( uv );
	if ( Distance > Radius )
		discard;
	gl_FragColor = Rgba;
 */
	
}

