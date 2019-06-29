
Pop.Include = function(Filename)
{
	let Source = Pop.LoadFileAsString(Filename);
	return Pop.CompileAndRun( Source, Filename );
}

Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopTexture.js');

const ParticleTrianglesVertShader = Pop.LoadFileAsString('ParticleTriangles.vert.glsl');
const QuadVertShader = Pop.LoadFileAsString('Quad.vert.glsl');
const ParticleColorShader = Pop.LoadFileAsString('ParticleColour.frag.glsl');
const BlitCopyShader = Pop.LoadFileAsString('BlitCopy.frag.glsl');
const ParticlePhysicsIteration_UpdateVelocity = Pop.LoadFileAsString('PhysicsIteration_UpdateVelocity.frag.glsl');
const ParticlePhysicsIteration_UpdatePosition = Pop.LoadFileAsString('PhysicsIteration_UpdatePosition.frag.glsl');



function LoadPlyGeometry(RenderTarget,Filename,WorldPositionImage)
{
	let VertexSize = 2;
	let VertexData = [];
	let TriangleIndexes = [];
	let WorldPositions = [];
	let WorldMin = [null,null,null];
	let WorldMax = [null,null,null];

	let AddTriangle = function(TriangleIndex,x,y,z)
	{
		let FirstTriangleIndex = VertexData.length / VertexSize;
		
		let Verts;
		if ( VertexSize == 2 )
			Verts = [	0,TriangleIndex,	1,TriangleIndex,	2,TriangleIndex	];
		else
			Verts = [	x,y,z,0,	x,y,z,1,	x,y,z,2	];
		Verts.forEach( v => VertexData.push(v) );
		
		let TriangleIndexes = [0,1,2];
		TriangleIndexes.forEach( i => TriangleIndexes.push( i + FirstTriangleIndex ) );
	}
	
	let TriangleCounter = 0;
	let OnVertex = function(x,y,z)
	{
		if ( TriangleCounter == 0 )
		{
			WorldMin = [x,y,z];
			WorldMax = [x,y,z];
		}
		AddTriangle( TriangleCounter,x,y,z );
		TriangleCounter++;
		WorldPositions.push( [x,y,z] );
		WorldMin[0] = Math.min( WorldMin[0], x );
		WorldMin[1] = Math.min( WorldMin[1], y );
		WorldMin[2] = Math.min( WorldMin[2], z );
		WorldMax[0] = Math.max( WorldMax[0], x );
		WorldMax[1] = Math.max( WorldMax[1], y );
		WorldMax[2] = Math.max( WorldMax[2], z );
	}
	
	if ( Filename.endsWith('.ply') )
		Pop.ParsePlyFile(Filename,OnVertex);
	else if ( Filename.endsWith('.obj') )
		Pop.ParseObjFile(Filename,OnVertex);
	else
		throw "Don't know how to load " + Filename;
	
	if ( WorldPositionImage )
	{
		let FloatFormat = true;
		let Channels = 3;
		let Quantisise = true;
		let NormaliseCoord8 = function(x)
		{
			return Math.floor(x * 255);
		}
		let NormaliseCoordf = function(x,Index)
		{
			return x;
		}
		let ScaleCoord = FloatFormat ? NormaliseCoordf : NormaliseCoord8;
		const Width = 1024;
		const Height = Math.ceil( WorldPositions.length / Width );
		let WorldPixels = FloatFormat ? new Float32Array( Channels * Width*Height ) : new Uint8Array( Channels * Width*Height );
		let PushPixel = function(xyz,Index)
		{
			//	normalize and turn into 0-255
			let x = Quantisise ? Math.Range( WorldMin[0], WorldMax[0], xyz[0] ) : xyz[0];
			let y = Quantisise ? Math.Range( WorldMin[1], WorldMax[1], xyz[1] ) : xyz[1];
			let z = Quantisise ? Math.Range( WorldMin[2], WorldMax[2], xyz[2] ) : xyz[2];
			Index *= Channels;
			x = ScaleCoord(x,Index);
			y = ScaleCoord(y,Index);
			z = ScaleCoord(z,Index);
			Pop.Debug(WorldMin,WorldMax,x,y,z);
			WorldPixels[Index+0] = x;
			WorldPixels[Index+1] = y;
			WorldPixels[Index+2] = z;
		}
		WorldPositions.forEach( PushPixel );
		
		WorldPositionImage.WritePixels( Width, Height, WorldPixels, FloatFormat ? 'Float3' : 'RGB' );
		
	}
	
	const VertexAttributeName = "Vertex";
	
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return TriangleBuffer;
}


//	todo: tie with render target!
let QuadGeometry = null;
function GetQuadGeometry(RenderTarget)
{
	if ( QuadGeometry )
		return QuadGeometry;

	let VertexSize = 2;
	let l = 0;
	let t = 0;
	let r = 1;
	let b = 1;
	let VertexData = [	l,t,	r,t,	r,b,	l,b	];
	let TriangleIndexes = [0,1,2,	2,3,0];
	
	const VertexAttributeName = "TexCoord";
	
	QuadGeometry = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return QuadGeometry;
}



function UnrollHexToRgb(Hexs)
{
	let Rgbs = [];
	let PushRgb = function(Hex)
	{
		let Rgb = HexToRgb(Hex);
		Rgbs.push( Rgb[0]/255 );
		Rgbs.push( Rgb[1]/255 );
		Rgbs.push( Rgb[2]/255 );
	}
	Hexs.forEach( PushRgb );
	return Rgbs;
}

//	colours from colorbrewer2.org
const SeaColoursHex = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081'];
const SeaColours = UnrollHexToRgb(SeaColoursHex);
const ShellColoursHex = [0xF2BF5E,0xF28705,0xBF5B04,0x730c02,0xF2F2F2,0xE0CEB2,0x9A7F5F,0xEBDEC3,0x5B3920,0x755E47,0x7F6854,0x8B7361,0xBF612A,0xD99873,0x591902,0xA62103];
const ShellColours = UnrollHexToRgb(ShellColoursHex);
const FogColour = HexToRgbf(0x4e646e);
const FogColourCorrect = HexToRgbf("#4e646e");
Pop.Debug("FogColour", 0x4e646e, FogColour, FogColourCorrect);


let Camera = {};
Camera.Position = [ 5,1.0,20 ];
Camera.LookAt = [ 0,0,0 ];
Camera.Aperture = 0.1;
Camera.LowerLeftCorner = [0,0,0];
Camera.DistToFocus = 1;
Camera.Horizontal = [0,0,0];
Camera.Vertical = [0,0,0];
Camera.LensRadius = 1;
Camera.Aperture = 0.015;
Camera.VerticalFieldOfView = 45;
Camera.NearDistance = 0.01;
Camera.FarDistance = 100;

function vec3_length(v)
{
	return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
}

function vec3_squared_length(v)
{
	return v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
}

function vec3_multiply(v1,n)
{
	let x = v1[0] * n;
	let y = v1[1] * n;
	let z = v1[2] * n;
	return [x,y,z];
}

function vec3_multiply_float(v1,n)
{
	let x = v1[0] * n;
	let y = v1[1] * n;
	let z = v1[2] * n;
	return [x,y,z];
}

function vec3_multiply_vec(v1,v2)
{
	let x = v1[0] * v2[0];
	let y = v1[1] * v2[1];
	let z = v1[2] * v2[2];
	return [x,y,z];
}

function vec3_divide(v1,n)
{
	let x = v1[0] / n;
	let y = v1[1] / n;
	let z = v1[2] / n;
	return [x,y,z];
}

function vec3_divide_float(v1,n)
{
	let x = v1[0] / n;
	let y = v1[1] / n;
	let z = v1[2] / n;
	return [x,y,z];
}

function vec3_add_vec(v1,v2)
{
	let x = v1[0] + v2[0];
	let y = v1[1] + v2[1];
	let z = v1[2] + v2[2];
	return [x,y,z];
}

function vec3_subtract_vec(v1, v2)
{
	let x = v1[0] - v2[0];
	let y = v1[1] - v2[1];
	let z = v1[2] - v2[2];
	return [x,y,z];
}

function vec3_subtract_float(v1,n)
{
	let x = v1[0] - n;
	let y = v1[1] - n;
	let z = v1[2] - n;
	return [x,y,z];
}

function unit_vector(v1)
{
	let v_ = vec3_divide_float(v1, vec3_length(v1));
	return v_;
}

function vec3_dot(v1,v2)
{
	return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function vec3_cross(v1,v2)
{
	let x = v1[1] * v2[2] - v1[2] * v2[1];
	let y = - (v1[0] * v2[2] - v1[2] * v2[0]);
	let z = v1[0] * v2[1] - v1[1] * v2[0];
	return [x,y,z];
}

function camera_pos(cam,vup,vfov,aspect,focus_dist)
{
	const M_PI = 3.1415926535897932384626433832795;

	let aperture = cam.Aperture;
	
	cam.LensRadius = aperture / 2.0;
	let theta = vfov * M_PI / 180.0;
	let half_height = Math.tan (theta / 2.0);
	let half_width = aspect * half_height;
	cam.w = unit_vector( vec3_subtract_vec( cam.Position, cam.LookAt ) );
	cam.u = unit_vector( vec3_cross( vup, cam.w ) );
	cam.v = vec3_cross( cam.w, cam.u );
	cam.LowerLeftCorner =
	vec3_subtract_vec(
					  vec3_subtract_vec(
										vec3_subtract_vec( cam.Position,
														  vec3_multiply_float( cam.u, half_width * focus_dist )),
										vec3_multiply_float( cam.v, half_height * focus_dist )),
					  vec3_multiply_float( cam.w, focus_dist ));
	cam.Horizontal  = vec3_multiply_float( cam.u,  2 * half_width * focus_dist );
	cam.Vertical  = vec3_multiply_float( cam.v, 2 * half_height * focus_dist );
}


function perspective(out, fovy, aspect, near, far)
{
	var f = 1.0 / Math.tan( Math.radians(fovy) / 2);
	var nf = 1 / (near - far);
	
	out = out || [];
	out[0] = f / aspect;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = f;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = (far + near) * nf;
	out[11] = -1;
	out[12] = 0;
	out[13] = 0;
	out[14] = 2 * far * near * nf;
	out[15] = 0;
	return out;
}

function UpdateCamera(RenderTarget)
{
	let Rect = RenderTarget.GetScreenRect();
	RenderTarget.GetWidth = function(){	return Rect[2]; };
	RenderTarget.GetHeight = function(){	return Rect[3]; };
	
	Camera.DistToFocus = vec3_length( vec3_subtract_vec( Camera.Position, Camera.LookAt ) );
	
	let Up = [0,1,0];
	let Aspect = RenderTarget.GetWidth() / RenderTarget.GetHeight();
	
	camera_pos( Camera, Up, Camera.VerticalFieldOfView, Aspect, Camera.DistToFocus );
	
	Camera.ProjectionMatrix = perspective( [], Camera.VerticalFieldOfView, Aspect, Camera.NearDistance, Camera.FarDistance );
	
}

function OnCameraPan(x,y,FirstClick)
{
	if ( FirstClick )
		Camera.LastPanPos = [x,y];
	
	let Deltax = Camera.LastPanPos[0] - x;
	let Deltay = Camera.LastPanPos[1] - y;
	Camera.Position[0] += Deltax * 0.01
	Camera.Position[1] -= Deltay * 0.01
	
	Camera.LastPanPos = [x,y];
}

function OnCameraZoom(x,y,FirstClick)
{
	if ( FirstClick )
		Camera.LastZoomPos = [x,y];
	
	let Deltax = Camera.LastZoomPos[0] - x;
	let Deltay = Camera.LastZoomPos[1] - y;
	//Camera.Position[0] -= Deltax * 0.01
	Camera.Position[2] -= Deltay * 0.01
	
	Camera.LastZoomPos = [x,y];
}



function PhysicsIteration(RenderTarget,PositionTexture,VelocityTexture,ScratchTexture)
{
	let CopyShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	let UpdateVelocityShader = Pop.GetShader( RenderTarget, ParticlePhysicsIteration_UpdateVelocity, QuadVertShader );
	let UpdatePositionsShader = Pop.GetShader( RenderTarget, ParticlePhysicsIteration_UpdatePosition, QuadVertShader );
	let Quad = GetQuadGeometry(RenderTarget);

	//	copy old velocitys
	let CopyVelcoityToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('Texture',VelocityTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyVelcoityToScratch );
	
	//	update velocitys
	let UpdateVelocitys = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('Noise', RandomTexture);
			Shader.SetUniform('LastVelocitys',ScratchTexture);
		}
		RenderTarget.DrawGeometry( Quad, UpdateVelocityShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( VelocityTexture, UpdateVelocitys );
	
	//	copy old positions
	let CopyPositionsToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('Texture',PositionTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyPositionsToScratch );

	//	update positions
	let UpdatePositions = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('Velocitys',Velocitys);
			Shader.SetUniform('LastPositions',ScratchTexture);
		}
		RenderTarget.DrawGeometry( Quad, UpdatePositionsShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( PositionTexture, UpdateVelocitys );
	
}





let NoiseTexture = new Pop.Image('Noise0.png');
//const SeaWorldPositionsPlyFilename = 'seatest.ply';
//const SeaWorldPositionsPlyFilename = 'Shell/shellSmall.ply';
const SeaWorldPositionsPlyFilename = 'Shell/shellFromBlender.obj';


function TActor(GeoFilename,Colours)
{
	this.TriangleBuffer = null;
	this.Colours = Colours;
	
	this.PhysicsIteration = function(RenderTarget)
	{
		//	need data initialised
		this.GetTriangleBuffer(RenderTarget);
		
		//Pop.Debug("PhysicsIteration", JSON.stringify(this) );
		PhysicsIteration( RenderTarget, this.PositionTexture, this.VelocityTexture, this.ScratchTexture );
	}
	
	this.ResetPhysicsTextures = function()
	{
		//Pop.Debug("ResetPhysicsTextures", JSON.stringify(this) );
		//	need to init these to zero?
		const Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		this.VelocityTexture = new Pop.Image(Size,'Float4');
		this.ScratchTexture = new Pop.Image(Size,'Float4');
	}
	
	this.GetTriangleBuffer = function(RenderTarget)
	{
		if ( this.TriangleBuffer )
			return this.TriangleBuffer;
		
		this.PositionTexture = new Pop.Image();
		this.TriangleBuffer = LoadPlyGeometry( RenderTarget, GeoFilename, this.PositionTexture );
		this.ResetPhysicsTextures();
		
		return this.TriangleBuffer;
	}
}

let Actor_Shell = new TActor('Shell/shellFromBlender.obj',ShellColours);
let Actor_SeaSurface = new TActor('SeaTest.ply',SeaColours);
let RandomTexture = Pop.CreateRandomImage( 1024, 1024 );

let FogParams = {};
//	todo: radial vs ortho etc
FogParams.MinDistance = 5;
FogParams.MaxDistance = 20;
FogParams.Colour = FogColour;

function RenderActor(RenderTarget,Actor)
{
	if ( !Actor )
		return;
	let Shader = Pop.GetShader( RenderTarget, ParticleColorShader, ParticleTrianglesVertShader );

	let SetUniforms = function(Shader)
	{
		Shader.SetUniform('WorldPositions',Actor.PositionTexture);
		Shader.SetUniform('WorldPositionsWidth',Actor.PositionTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',Actor.PositionTexture.GetHeight());
	
		Shader.SetUniform('Colours',Actor.Colours);
		Shader.SetUniform('ColourCount',Actor.Colours.length/3);
		Shader.SetUniform('CameraProjectionMatrix', Camera.ProjectionMatrix );
		Shader.SetUniform('CameraWorldPosition',Camera.Position);
		Shader.SetUniform('Fog_MinDistance',FogParams.MinDistance);
		Shader.SetUniform('Fog_MaxDistance',FogParams.MaxDistance);
		Shader.SetUniform('Fog_Colour',FogParams.Colour);
	};
	
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
}

function Render(RenderTarget)
{
	UpdateCamera(RenderTarget);

	//	update physics
	if ( Actor_Shell )
		Actor_Shell.PhysicsIteration(RenderTarget);
	if ( Actor_SeaSurface )
		Actor_SeaSurface.PhysicsIteration(RenderTarget);

	RenderTarget.ClearColour( FogColour[0],FogColour[1],FogColour[2] );
	RenderActor( RenderTarget, Actor_Shell );
	RenderActor( RenderTarget, Actor_SeaSurface );
}

let Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = Render;

Window.OnMouseDown = function(x,y,Button)
{
	if ( Button == 0 )
		OnCameraPan( x, y, true );
	if ( Button == 1 )
		OnCameraZoom( x, y, true );
}

Window.OnMouseMove = function(x,y,Button)
{
	if ( Button == 0 )
		OnCameraPan( x, y, false );
	if ( Button == 1 )
		OnCameraZoom( x, y, false );
};

