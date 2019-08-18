attribute float3 LocalPosition;
varying float3 Colour;
varying float3 WorldPosition;
varying float3 FragLocalPosition;

uniform mat4 LocalToWorldTransform;
uniform mat4 WorldToCameraTransform;
uniform mat4 CameraProjectionTransform;

const float LocalScale = 1.0;

void main()
{
	float3 LocalPos = LocalPosition*LocalScale;
	
	//float3 WorldPos = LocalPos + Transform_WorldPosition;
	//WorldPos *= WorldScale;
	float4 WorldPos = LocalToWorldTransform * float4(LocalPos,1);
	//WorldPos.xyz /= WorldPos.w;
	
	float4 CameraPos = WorldToCameraTransform * WorldPos;	//	world to camera space
	//CameraPos.xyz /= CameraPos.w;
	//CameraPos.w = 1.0;
	float4 ProjectionPos = CameraProjectionTransform * CameraPos;
	gl_Position = ProjectionPos;
	
	WorldPosition = WorldPos.xyz;
	Colour = LocalPosition;
	FragLocalPosition = LocalPosition;
}

