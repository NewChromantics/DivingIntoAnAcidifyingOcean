
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

const NoiseTexture = new Pop.Image('Noise0.png');




function LoadPlyGeometry(RenderTarget,Filename,WorldPositionImage,Scale)
{
	let VertexSize = 2;
	let VertexData = [];
	let VertexDataCount = 0;
	let TriangleIndexes = [];
	let TriangleIndexCount = 0;
	let WorldPositions = [];
	let WorldPositionsCount = 0;
	let WorldPositionSize = 3;
	let WorldMin = [null,null,null];
	let WorldMax = [null,null,null];

	let PushIndex = function(Index)
	{
		TriangleIndexes.push(Index);
	}
	let PushVertexData = function(f)
	{
		VertexData.push(f);
	}
	let GetVertexDataLength = function()
	{
		return VertexData.length;
	}
	let PushWorldPos = function(x,y,z)
	{
		WorldPositions.push([x,y,z]);
	}
	

	//	replace data with arrays... no noticable speed improvement!
	let OnMeta = function(Meta)
	{
		/*
		VertexData = new Float32Array( Meta.VertexCount * 3 * VertexSize );
		PushVertexData = function(f)
		{
			VertexData[VertexDataCount] = f;
			VertexDataCount++;
		}
		GetVertexDataLength = function()
		{
			return VertexDataCount;
		}
		*/
		
		TriangleIndexes = new Int32Array( Meta.VertexCount * 3 );
		PushIndex = function(f)
		{
			TriangleIndexes[TriangleIndexCount] = f;
			TriangleIndexCount++;
		}
		/*
		WorldPositions = new Float32Array( Meta.VertexCount * 3 );
		PushWorldPos = function(x,y,z)
		{
			WorldPositions[WorldPositionsCount+0] = x;
			WorldPositions[WorldPositionsCount+1] = y;
			WorldPositions[WorldPositionsCount+2] = z;
			WorldPositionsCount += 3;
		}
		*/
	}
	OnMeta = undefined;

	let AddTriangle = function(TriangleIndex,x,y,z)
	{
		let FirstTriangleIndex = GetVertexDataLength() / VertexSize;
		
		let Verts;
		if ( VertexSize == 2 )
			Verts = [	0,TriangleIndex,	1,TriangleIndex,	2,TriangleIndex	];
		else
			Verts = [	x,y,z,0,	x,y,z,1,	x,y,z,2	];
		Verts.forEach( v => PushVertexData(v) );
		
		PushIndex( FirstTriangleIndex+0 );
		PushIndex( FirstTriangleIndex+1 );
		PushIndex( FirstTriangleIndex+2 );
	}
	
	let TriangleCounter = 0;
	let OnVertex = function(x,y,z)
	{
		/*
		if ( TriangleCounter == 0 )
		{
			WorldMin = [x,y,z];
			WorldMax = [x,y,z];
		}
		*/
		AddTriangle( TriangleCounter,x,y,z );
		TriangleCounter++;
		PushWorldPos( x,y,z );
		/*
		WorldMin[0] = Math.min( WorldMin[0], x );
		WorldMin[1] = Math.min( WorldMin[1], y );
		WorldMin[2] = Math.min( WorldMin[2], z );
		WorldMax[0] = Math.max( WorldMax[0], x );
		WorldMax[1] = Math.max( WorldMax[1], y );
		WorldMax[2] = Math.max( WorldMax[2], z );
		*/
	}
	
	let LoadTime = Pop.GetTimeNowMs();
	if ( Filename.endsWith('.ply') )
		Pop.ParsePlyFile(Filename,OnVertex,OnMeta);
	else if ( Filename.endsWith('.obj') )
		Pop.ParseObjFile(Filename,OnVertex,OnMeta);
	else
		throw "Don't know how to load " + Filename;
	
	Pop.Debug("Loading took", Pop.GetTimeNowMs()-LoadTime);
	
	if ( WorldPositionImage )
	{
		//	sort the positions
		let SortPosition = function(a,b)
		{
			if ( a[2] < b[2] )	return -1;
			if ( a[2] > b[2] )	return 1;
			return 0;
		}
		WorldPositions.sort(SortPosition);
		//	unroll
		let Unrolled = [];
		WorldPositions.forEach( xyz => {	Unrolled.push(xyz[0]);	Unrolled.push(xyz[1]);	Unrolled.push(xyz[2]);}	);
		WorldPositions = Unrolled;
		
		let WorldPosTime = Pop.GetTimeNowMs();

		Scale = Scale||1;
		let Channels = 3;
		let Quantisise = false;
	
		let NormaliseCoordf = function(x,Index)
		{
			x *= Scale;
			return x;
		}
		
		const Width = 1024;
		const Height = Math.ceil( WorldPositions.length / WorldPositionSize / Width );
		let WorldPixels = new Float32Array( Channels * Width*Height );
		//WorldPositions.copyWithin( WorldPixels );
		
		let ModifyXyz = function(Index)
		{
			Index *= Channels;
			let x = WorldPixels[Index+0];
			let y = WorldPixels[Index+1];
			let z = WorldPixels[Index+2];
			//	normalize and turn into 0-255
			x = Quantisise ? Math.Range( WorldMin[0], WorldMax[0], x ) : x;
			y = Quantisise ? Math.Range( WorldMin[1], WorldMax[1], y ) : y;
			z = Quantisise ? Math.Range( WorldMin[2], WorldMax[2], z ) : z;
			x = NormaliseCoordf(x);
			y = NormaliseCoordf(y);
			z = NormaliseCoordf(z);
			//Pop.Debug(WorldMin,WorldMax,x,y,z);
			WorldPixels[Index+0] = x;
			WorldPixels[Index+1] = y;
			WorldPixels[Index+2] = z;
		}
	
		let PushPixel = function(xyz,Index)
		{
			WorldPixels[Index*Channels+0] = xyz[0];
			WorldPixels[Index*Channels+1] = xyz[1];
			WorldPixels[Index*Channels+2] = xyz[2];
			ModifyXyz( Index );
		}
		for ( let i=0;	i<WorldPositions.length;	i+=WorldPositionSize )
		{
			PushPixel( WorldPositions.slice(i,i+WorldPositionSize), i/WorldPositionSize );
		//	ModifyXyz( WorldPositions.slice(i,i+WorldPositionSize), i/WorldPositionSize );
		}
		
		Pop.Debug("Making world positions took", Pop.GetTimeNowMs()-WorldPosTime);

		let WriteTime = Pop.GetTimeNowMs();
		WorldPositionImage.WritePixels( Width, Height, WorldPixels, 'Float3' );
		Pop.Debug("Making world texture took", Pop.GetTimeNowMs()-WriteTime);
	}
	
	const VertexAttributeName = "Vertex";
	
	//	loads much faster as a typed array
	VertexData = new Float32Array( VertexData );
	TriangleIndexes = new Int32Array(TriangleIndexes);
	
	let CreateBufferTime = Pop.GetTimeNowMs();
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	Pop.Debug("Making triangle buffer took", Pop.GetTimeNowMs()-CreateBufferTime);
	
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
const OceanColoursHex = ['#c9e7f2','#4eb3d3','#2b8cbe','#0868ac','#084081','#023859','#03658c','#218da6','#17aebf','#15bfbf'];
//const OceanColoursHex = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081'];
const OceanColours = UnrollHexToRgb(OceanColoursHex);
const ShellColoursHex = [0xF2BF5E,0xF28705,0xBF5B04,0x730c02,0xF2F2F2,0xE0CEB2,0x9A7F5F,0xEBDEC3,0x5B3920,0x755E47,0x7F6854,0x8B7361,0xBF612A,0xD99873,0x591902,0xA62103];
const ShellColours = UnrollHexToRgb(ShellColoursHex);
const FogColour = HexToRgbf(0x4e646e);
const FogColourCorrect = HexToRgbf("#4e646e");
Pop.Debug("FogColour", 0x4e646e, FogColour, FogColourCorrect);


let Camera = {};
Camera.Position = [ 0,1.0,10 ];
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




//const SeaWorldPositionsPlyFilename = 'seatest.ply';
//const SeaWorldPositionsPlyFilename = 'Shell/shellSmall.ply';
const SeaWorldPositionsPlyFilename = 'Shell/shellFromBlender.obj';


function TPhysicsActor(GeoFilename,Colours)
{
	this.TriangleBuffer = null;
	this.Colours = Colours;
	
	this.PhysicsIteration = function(DurationSecs,RenderTarget)
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
	
	this.GetPositionsTexture = function()
	{
		return this.PositionTexture;
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

function TAnimationBuffer(Filenames)
{
	this.Frames = null;
	
	this.Init = function(RenderTarget)
	{
		if ( this.Frames )
			return;
		
		let LoadFrame = function(Filename,Index)
		{
			let Scale = 1.0;
			let FrameDuration = 1/30;
			let Frame = {};
			Frame.Time = Index * FrameDuration;
			Frame.PositionTexture = new Pop.Image();
			Frame.TriangleBuffer = LoadPlyGeometry( RenderTarget, Filename, Frame.PositionTexture, Scale );
			this.Frames.push(Frame);
		}

		this.Frames = [];
		Filenames.forEach( LoadFrame.bind(this) );
	}
	
	this.GetDuration = function()
	{
		return this.Frames[this.Frames.length-1].Time;
	}
	
	this.GetFrame = function(Time)
	{
		Time = Time % this.GetDuration();
		for ( let i=0;	i<this.Frames.length;	i++ )
		{
			let Frame = this.Frames[i];
			if ( Time <= Frame.Time )
				return Frame;
		}
		throw "Failed to find frame for time " + Time;
	}
	
	this.GetTriangleBuffer = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.TriangleBuffer;
	}
	
	this.GetPositionsTexture = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.PositionTexture;
	}
	
}


function TAnimatedActor(GeoFilenames,Colours)
{
	this.Animation = new TAnimationBuffer(GeoFilenames);
	this.TriangleBuffer = null;
	this.Colours = Colours;
	this.Time = 0;
	
	this.PhysicsIteration = function(DurationSecs,RenderTarget)
	{
		this.Animation.Init(RenderTarget);
		this.Time += DurationSecs;
	}
	
	this.GetTriangleBuffer = function(RenderTarget)
	{
		const tb = this.Animation.GetTriangleBuffer( this.Time );
		return tb;
	}

	this.GetPositionsTexture = function(RenderTarget)
	{
		const tb = this.Animation.GetPositionsTexture( this.Time );
		return tb;
	}
}




let OceanFilenames = [];
for ( let i=1;	i<=96;	i++ )
//for ( let i=1;	i<=2;	i++ )
	OceanFilenames.push('Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply');

let Actor_Shell = new TPhysicsActor( 'Shell/shellFromBlender.obj', ShellColours );
let Actor_Ocean = new TAnimatedActor( OceanFilenames, OceanColours );
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
	
	const Shader = Pop.GetShader( RenderTarget, ParticleColorShader, ParticleTrianglesVertShader );
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	const PositionsTexture = Actor.GetPositionsTexture();

	let SetUniforms = function(Shader)
	{
		Shader.SetUniform('WorldPositions',PositionsTexture);
		Shader.SetUniform('WorldPositionsWidth',PositionsTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',PositionsTexture.GetHeight());
	
		Shader.SetUniform('Colours',Actor.Colours);
		Shader.SetUniform('ColourCount',Actor.Colours.length/3);
		Shader.SetUniform('CameraProjectionMatrix', Camera.ProjectionMatrix );
		Shader.SetUniform('CameraWorldPosition',Camera.Position);
		Shader.SetUniform('Fog_MinDistance',FogParams.MinDistance);
		Shader.SetUniform('Fog_MaxDistance',FogParams.MaxDistance);
		Shader.SetUniform('Fog_Colour',FogParams.Colour);
	};
	
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
}

function Render(RenderTarget)
{
	UpdateCamera(RenderTarget);

	const DurationSecs = 1 / 60;
	
	//	update physics
	if ( Actor_Shell )
		Actor_Shell.PhysicsIteration( DurationSecs, RenderTarget );
	if ( Actor_Ocean )
		Actor_Ocean.PhysicsIteration( DurationSecs, RenderTarget );

	RenderTarget.ClearColour( FogColour[0],FogColour[1],FogColour[2] );
	RenderActor( RenderTarget, Actor_Shell );
	RenderActor( RenderTarget, Actor_Ocean );
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

