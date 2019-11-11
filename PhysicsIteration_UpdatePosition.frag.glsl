precision highp float;

varying vec2 uv;
uniform sampler2D LastPositions;
uniform sampler2D Velocitys;
uniform float PhysicsStep;//= 1.0/60.0;
uniform bool FirstUpdate;

float3 GetInputVelocity(float2 uv)
{
	if ( FirstUpdate )
		return float3(0,0,0);
	
	vec4 Vel = texture2D( Velocitys, uv );
	//	todo: use w as scalar
	Vel.xyz -= float3( 0.5, 0.5, 0.5 );
	return Vel.xyz;
}


float3 GetInputPosition(float2 uv)
{
	if ( FirstUpdate )
		return float3(0,0,0);
	
	vec4 Pos = texture2D( LastPositions, uv );
	//	todo: use w as scalar
	Pos.xyz -= float3( 0.5, 0.5, 0.5 );
	
	return Pos.xyz;
}

float4 GetOutputPosition(float3 Position)
{
	Position += float3( 0.5, 0.5, 0.5 );
	return float4( Position, 1.0 );
}

void main()
{
	//	gr: this should make sure it's sample middle of texel
	vec3 Pos = GetInputPosition( uv );
	vec3 Vel = GetInputVelocity( uv );
	Pos += Vel * PhysicsStep;
	
	gl_FragColor = GetOutputPosition( Pos );
}


