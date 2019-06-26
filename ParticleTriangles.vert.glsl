#version 410
uniform vec4 VertexRect = vec4(0,0,1,1);
in vec2 TexCoord;
out vec2 uv;
out vec4 Rgba;

uniform mat4 CameraProjectionMatrix;

void main()
{
	float l = VertexRect[0];
	float t = VertexRect[1];
	float r = l+VertexRect[2];
	float b = t+VertexRect[3];
	
	l = mix( -1, 1, l );
	r = mix( -1, 1, r );
	t = mix( 1, -1, t );
	b = mix( 1, -1, b );
	
	vec3 LocalPos = vec3( mix( l, r, TexCoord.x ), mix( l, r, TexCoord.y ), 0 );
	vec3 WorldPos = vec3( 0,0,1);
	vec3 CameraPos = WorldPos;	//	world to camera space
	vec4 ProjectionPos = CameraProjectionMatrix * vec4( CameraPos, 1 );
	gl_Position = ProjectionPos;
	
	
	uv = vec2( TexCoord.x, TexCoord.y );
	Rgba = vec4( 1,0,0,1 );
}

