Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopCinema4d.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');

Pop.Include('AssetManager.js');
Pop.Include('AudioManager.js');

const ParticleColorShader = Pop.LoadFileAsString('ParticleColour.frag.glsl');
const GeoVertShader = Pop.LoadFileAsString('Geo.vert.glsl');
const ColourFragShader = Pop.LoadFileAsString('Colour.frag.glsl');
const EdgeFragShader = Pop.LoadFileAsString('Edge.frag.glsl');





function UnrollHexToRgb(Hexs)
{
	let Rgbs = [];
	let PushRgb = function(Hex)
	{
		let Rgb = Pop.Colour.HexToRgb(Hex);
		Rgbs.push( Rgb[0]/255 );
		Rgbs.push( Rgb[1]/255 );
		Rgbs.push( Rgb[2]/255 );
	}
	Hexs.forEach( PushRgb );
	return Rgbs;
}

//	colours from colorbrewer2.org
const OceanColoursHex = ['#c9e7f2','#4eb3d3','#2b8cbe','#0868ac','#084081','#023859','#03658c','#218da6','#17aebf','#15bfbf'];
const DebrisColoursHex = ['#084081','#0868ac'];
//const OceanColoursHex = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081'];
const OceanColours = UnrollHexToRgb(OceanColoursHex);
const ShellColoursHex = [0xF2BF5E,0xF28705,0xBF5B04,0x730c02,0xc2ae8f,0x9A7F5F,0xbfb39b,0x5B3920,0x755E47,0x7F6854,0x8B7361,0xBF612A,0xD99873,0x591902,0xA62103];
const ShellColours = UnrollHexToRgb(ShellColoursHex);
const FogColour = Pop.Colour.HexToRgbf(0x000000);
const LightColour = [0.86,0.95,0.94];

const DebrisColours = UnrollHexToRgb(DebrisColoursHex);

let DebugCamera = new Pop.Camera();
DebugCamera.Position = [ 0,0,0 ];
DebugCamera.LookAt = [ 0,0,-1 ];
DebugCamera.FarDistance = 300;	//	try not to clip anythig in debug mode


function TKeyframe(Time,Uniforms)
{
	this.Time = Time;
	this.Uniforms = Uniforms;
}

function LerpValue(a,b,Lerp)
{
	if ( Array.isArray(a) )
		return Math.LerpArray( a, b, Lerp );

	let IsLerpable = ( typeof a == 'number' );

	//	bool, string, object, return previous until we hit next keyframe
	if ( !IsLerpable )
		return (Lerp < 1.0) ? a : b;
	
	//	lerp number
	return Math.Lerp( a, b, Lerp );
}

function TTimeline(OrigKeyframes)
{
	//	gr: Expecting time to be sorted
	this.Keyframes = OrigKeyframes;

	this.Constructor = function()
	{
		this.FillKeyframes();
	}
	
	this.EnumAllUniforms = function()
	{
		//	keyed list and their first & last keyframe time
		let Uniforms = {};
		
		let EnumUniforms = function(Keyframe)
		{
			let EnumUniform = function(Uniform)
			{
				//	init new uniform
				if ( !Uniforms.hasOwnProperty(Uniform) )
				{
					Uniforms[Uniform] = {};
					Uniforms[Uniform].FirstKeyframeTime = Keyframe.Time;
					Uniforms[Uniform].LastKeyframeTime = null;
				}
				//	update existing uniform
				Uniforms[Uniform].LastKeyframeTime = Keyframe.Time;
			}
			Object.keys( Keyframe.Uniforms ).forEach (EnumUniform);
		}
		this.Keyframes.forEach( EnumUniforms );
		
		return Uniforms;
	}
	
	//	any keyframes missing a uniform, we should in-fill
	//	we could do it in the lookup, but doing once might be simpler
	this.FillKeyframes = function()
	{
		//	get list of all uniforms
		const AllUniforms = this.EnumAllUniforms();
		//Pop.Debug( JSON.stringify( AllUniforms,null,'\t' ) );
		
		//	now go through all keyframes and fill gaps
		let FillKeyframe = function(Keyframe)
		{
			let FillUniform = function(UniformName)
			{
				//	already exists
				if ( Keyframe.Uniforms.hasOwnProperty(UniformName) )
					return;
				
				//	fill!
				let KnownUniform = AllUniforms[UniformName];
				if ( Keyframe.Time < KnownUniform.FirstKeyframeTime )
				{
					Keyframe.Uniforms[UniformName] = this.GetUniform( KnownUniform.FirstKeyframeTime, UniformName );
				}
				else if ( Keyframe.Time > KnownUniform.LastKeyframeTime )
				{
					Keyframe.Uniforms[UniformName] = this.GetUniform( KnownUniform.LastKeyframeTime, UniformName );
				}
				else
				{
					const Slice = this.GetTimeSliceForUniform( Keyframe.Time, UniformName );
					const PrevValue = this.Keyframes[Slice.StartIndex].Uniforms[UniformName];
					const NextValue = this.Keyframes[Slice.EndIndex].Uniforms[UniformName];
					Keyframe.Uniforms[UniformName] = LerpValue( PrevValue, NextValue, Slice.Lerp );
				}
			}
			Object.keys(AllUniforms).forEach(FillUniform.bind(this));
		}
		this.Keyframes.forEach( FillKeyframe.bind(this) );
					
		//Pop.Debug( "Filled keyframes", JSON.stringify(this.Keyframes,null,'\t') );
	}

	this.GetTimeSliceForUniform = function(Time,UniformName)
	{
		let Slice = {};
		Slice.StartIndex = undefined;
		Slice.EndIndex = undefined;
		
		for ( let i=0;	i<this.Keyframes.length;	i++ )
		{
			const Keyframe = this.Keyframes[i];
			if ( !Keyframe.Uniforms.hasOwnProperty(UniformName) )
				continue;
			
			//	find the latest keyframe that this could be
			if ( Keyframe.Time <= Time )
			{
				Slice.StartIndex = i;
			}
			
			//	find the first keyframe this could be
			if ( Slice.EndIndex === undefined && Keyframe.Time >= Time )
			{
				Slice.EndIndex = i;
			}
		}
		if ( Slice.StartIndex === undefined && Slice.EndIndex === undefined )
			throw "Uniform " + UniformName + " not found";
		//	there was only one match
		if ( Slice.EndIndex === undefined )
			Slice.EndIndex = Slice.StartIndex;
		if ( Slice.StartIndex === undefined )
			Slice.StartIndex = Slice.EndIndex;

		let StartTime = this.Keyframes[Slice.StartIndex].Time;
		let EndTime = this.Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	this.GetTimeSlice = function(Time)
	{
		let Slice = {};
		Slice.StartIndex = 0;
		
		for ( let i=0;	i<this.Keyframes.length-1;	i++ )
		{
			let t = this.Keyframes[i].Time;
			if ( t > Time )
			{
				//Pop.Debug( "Time > t", Time, t);
				break;
			}
			Slice.StartIndex = i;
		}
		Slice.EndIndex = Slice.StartIndex+1;
		
		let StartTime = this.Keyframes[Slice.StartIndex].Time;
		let EndTime = this.Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	this.GetUniform = function(Time,Key)
	{
		let Slice = this.GetTimeSliceForUniform( Time, Key );
		const UniformsA = this.Keyframes[Slice.StartIndex].Uniforms;
		const UniformsB = this.Keyframes[Slice.EndIndex].Uniforms;

		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			
			let Value = LerpValue( a, b, Slice.Lerp );
			return Value;
		}
		let Value = LerpUniform( Key );
		return Value;
	}
	
	this.EnumUniforms = function(Time,EnumUniform)
	{
		let Slice = this.GetTimeSlice( Time );
		let UniformsA = this.Keyframes[Slice.StartIndex].Uniforms;
		let UniformsB = this.Keyframes[Slice.EndIndex].Uniforms;
		let UniformKeys = Object.keys(UniformsA);
		
		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			let Value;
			
			if ( Array.isArray(a) )
				Value = Math.LerpArray( a, b, Slice.Lerp );
			else
				Value = Math.Lerp( a, b, Slice.Lerp );

			//Pop.Debug(Key, Value);
			EnumUniform( Key, Value );
		}
		UniformKeys.forEach( LerpUniform );
	}
	
	this.Constructor();
}




function LoadTimeline(Filename)
{
	const Contents = Pop.LoadFileAsString(Filename);
	const FileKeyframes = JSON.parse( Contents );
	const Keyframes = [];
	const PushKeyframe = function(KeyframeTimeKey)
	{
		const Uniforms = FileKeyframes[KeyframeTimeKey];
		const KeyframeTime = parseFloat(KeyframeTimeKey);
		if ( isNaN(KeyframeTime) )
			throw "Key in timeline is not a float: " + KeyframeTimeKey;
		const Keyframe = new TKeyframe( KeyframeTime, Uniforms );
		Keyframes.push( Keyframe );
	}
	Object.keys(FileKeyframes).forEach( PushKeyframe );
	const Timeline = new TTimeline( Keyframes );
	return Timeline;
}







//	scene!

let ShellMeta = {};
ShellMeta.Filename = 'Shell/shellFromBlender.obj';
ShellMeta.Position = [0,0,-2];
ShellMeta.Scale = 0.9;
ShellMeta.TriangleScale = 0.03;
ShellMeta.Colours = ShellColours;
ShellMeta.VertexSkip = 0;

let DebrisMeta = {};
DebrisMeta.Filename = '.random';
DebrisMeta.Position = [0,-17,0];
DebrisMeta.Scale = 30;
DebrisMeta.TriangleScale = 0.052015;	//	0.0398
DebrisMeta.Colours = DebrisColours;
DebrisMeta.VertexSkip = 0;


let OceanFilenames = [];
for ( let i=1;	i<=96;	i++ )
	OceanFilenames.push('Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply');

let OceanMeta = {};
OceanMeta.Filename = OceanFilenames;
OceanMeta.Position = [0,0,0];
OceanMeta.Scale = 1.0;
OceanMeta.TriangleScale = 0.0148;
OceanMeta.Colours = OceanColours;

//let Actor_Shell = new TPhysicsActor( ShellMeta );
let Actor_Shell = null;
let Actor_Ocean = new TAnimatedActor( OceanMeta );
let Actor_Debris = new TPhysicsActor( DebrisMeta );









const TimelineMinYear = 1400;
const TimelineMinInteractiveYear = 1860;
const TimelineMaxYear = 2100;
const TimelineMaxInteractiveYear = 2100;

Params.TimelineYear = TimelineMinYear;
Params.ExperiencePlaying = true;
Params.ExperienceDurationSecs = 240;
Params.UseDebugCamera = false;
Params.DebugCameraPositionCount = 200;
Params.DebugCameraPositionScale = 0.15;
Params.FogMinDistance = 11.37;
Params.FogMaxDistance = 24.45;
Params.FogColour = FogColour;
Params.LightColour = LightColour;
Params.Ocean_TriangleScale = OceanMeta.TriangleScale;
Params.Debris_TriangleScale = DebrisMeta.TriangleScale;
Params.DebugPhysicsTextures = false;
Params.BillboardTriangles = true;
Params.ShowClippedParticle = false;
Params.CameraNearDistance = 0.1;
Params.CameraFarDistance = 50;
Params.CameraFaceForward = true;
Params.AudioCrossFadeDurationSecs = 2;
Params.OceanAnimationFrameRate = 20;

let OnParamsChanged = function(Params,ChangedParamName)
{
	if ( Actor_Ocean )
		Actor_Ocean.Meta.TriangleScale = Params.Ocean_TriangleScale;
	
	if ( Actor_Debris )
		Actor_Debris.Meta.TriangleScale = Params.Debris_TriangleScale;
	
	if ( ChangedParamName == 'UseDebugCamera' && Params.UseDebugCamera )
		OnSwitchedToDebugCamera();
}

const ParamsWindowRect = [800,20,350,200];
let ParamsWindow = new CreateParamsWindow(Params,OnParamsChanged,ParamsWindowRect);
ParamsWindow.AddParam('TimelineYear',TimelineMinYear,TimelineMaxYear);	//	can no longer clean as we move timeline in float
ParamsWindow.AddParam('ExperiencePlaying');
ParamsWindow.AddParam('ExperienceDurationSecs',30,600);
ParamsWindow.AddParam('UseDebugCamera');
ParamsWindow.AddParam('DebugCameraPositionCount',0,200,Math.floor);
ParamsWindow.AddParam('DebugCameraPositionScale',0,1);
ParamsWindow.AddParam('FogColour','Colour');
ParamsWindow.AddParam('LightColour','Colour');
ParamsWindow.AddParam('Ocean_TriangleScale',0,1.2);
ParamsWindow.AddParam('Debris_TriangleScale',0,1.2);
ParamsWindow.AddParam('FogMinDistance',0,30);
ParamsWindow.AddParam('FogMaxDistance',0,100);
ParamsWindow.AddParam('EnablePhysicsIteration');
ParamsWindow.AddParam('DebugPhysicsTextures');
ParamsWindow.AddParam('BillboardTriangles');
ParamsWindow.AddParam('ShowClippedParticle');
ParamsWindow.AddParam('CameraNearDistance', 0.01, 10);
ParamsWindow.AddParam('CameraFarDistance', 1, 100);
ParamsWindow.AddParam('CameraFaceForward');
ParamsWindow.AddParam('AudioCrossFadeDurationSecs',0,10);
ParamsWindow.AddParam('OceanAnimationFrameRate',1,60);







function RenderTriangleBufferActor(RenderTarget,Actor,ActorIndex,SetGlobalUniforms,Time)
{
	if ( !Actor )
		return;
	
	const PositionsTexture = Actor.GetPositionsTexture();
	const VelocitysTexture = Actor.GetVelocitysTexture();
	const BlitShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	const Shader = Pop.GetShader( RenderTarget, ParticleColorShader, ParticleTrianglesVertShader );
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	
	
	//let Geo = GetAsset( Actor.Geometry, RenderTarget );
	//let Shader = Pop.GetShader( RenderTarget, Actor.FragShader, Actor.VertShader );
	const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];

	let SetUniforms = function(Shader)
	{
		SetGlobalUniforms( Shader );

		Shader.SetUniform('LocalToWorldTransform', Actor.GetTransformMatrix() );
		Shader.SetUniform('LocalPositions', LocalPositions );
		Shader.SetUniform('BillboardTriangles', Params.BillboardTriangles );
		Shader.SetUniform('WorldPositions',PositionsTexture);
		Shader.SetUniform('WorldPositionsWidth',PositionsTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',PositionsTexture.GetHeight());
		Shader.SetUniform('TriangleScale', Actor.Meta.TriangleScale);
		Shader.SetUniform('Colours',Actor.Colours);
		Shader.SetUniform('ColourCount',Actor.Colours.length/3);
	};
	
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
	
	
	if ( Params.DebugPhysicsTextures )
	{
		let w = 0.2;
		let x = ActorIndex * (w * 1.05);
		let Quad = GetQuadGeometry(RenderTarget);
		let SetDebugPositionsUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0, w, 0.25 ] );
			Shader.SetUniform('Texture',PositionsTexture);
		};
		let SetDebugVelocitysUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0.3, w, 0.25 ] );
			Shader.SetUniform('Texture',VelocitysTexture);
		};
	
		if ( PositionsTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugPositionsUniforms );
		if ( VelocitysTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugVelocitysUniforms );
	}
}


function LoadCameraSpline(Positions)
{
	//	make a new timeline
	const Keyframes = [];
	const CameraPositionUniform = 'CameraPosition';

	//	spline points are line strips from cinema 4D, which are more dense on curves.
	//	we need a linear spline
	const RunningDistances = [];
	RunningDistances[0] = 0;
	for ( let i=1;	i<Positions.length;	i++ )
	{
		const Prev = Positions[i-1];
		const Next = Positions[i];
		const Distance = Math.Distance3( Prev, Next );
		const LastDistance = RunningDistances[i-1];
		RunningDistances[i] = LastDistance + Distance;
	}
	const TotalDistance = RunningDistances[RunningDistances.length-1];
	
	const NormaliseSpline = !Pop.GetExeArguments().includes('RawCameraSpline');
	const DistanceToYear = function(Distance,PositionIndex)
	{
		const DistanceNormalised = Distance / TotalDistance;
		const IndexNormalised = PositionIndex / (Positions.length-1);
		const Time = NormaliseSpline ? DistanceNormalised : IndexNormalised;
		const Year = Math.Lerp( TimelineMinYear, TimelineMaxYear, Time );
		return Year;
	}
	
	//	now each pos can have a normalised time
	for ( let i=0;	i<Positions.length;	i++ )
	{
		const Year = DistanceToYear( RunningDistances[i], i );
		const Uniforms = [];
		Uniforms[CameraPositionUniform] = Positions[i];
		const Keyframe = new TKeyframe( Year, Uniforms );
		Keyframes.push( Keyframe );
	}

	const Timeline = new TTimeline( Keyframes );
	GetCameraTimelineAndUniform = function()
	{
		return [Timeline,CameraPositionUniform];
	}
}

function LoadCameraScene(Filename)
{
	let Scene = [];
	
	let OnSpline = function(SplineNode)
	{
		if ( SplineNode.Name == 'Camera_Spline' )
		{
			//	replace the global function
			//	make a new timeline to replace the default camera timeline accessor
			const CameraPath = SplineNode.PathPositions;
			LoadCameraSpline( CameraPath );
			return;
		}
		Pop.Debug("Found spline ", SplineNode.Name);
	}
	
	let OnActor = function(ActorNode)
	{
		if ( ActorNode.Name.startsWith('Water_') && Actor_Debris )
		{
			//	add an instance
			if ( !Actor_Debris.Instances )
				Actor_Debris.Instances = [];
			
			Actor_Debris.Instances.push( ActorNode.Position );
			//	temp until we do instances
			Actor_Debris.Position = ActorNode.Position;
			return;
		}
		
		
		if ( ActorNode.Name.startsWith('Ocean_surface_0') && Actor_Ocean )
		{
			//	add an instance
			if ( !Actor_Ocean.Instances )
				Actor_Ocean.Instances = [];

			Actor_Ocean.Instances.push( ActorNode.Position );
			//	temp until we do instances
			Actor_Ocean.Position = ActorNode.Position;
			return;
		}
		
		Pop.Debug("Loading actor", ActorNode.Name);
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
		Actor.Geometry = 'Cube';
		let LocalScale = Math.CreateScaleMatrix(0.1);
		let WorldPos = Math.CreateTranslationMatrix( ...ActorNode.Position );
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( WorldPos, LocalScale );
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = ColourFragShader;
		Scene.push( Actor );
	}
	
	if ( !Array.isArray(Filename) )
		Filename = [Filename];
	
	//	load each one
	let Load = function(Filename)
	{
		const FileContents = Pop.LoadFileAsString(Filename);
		if ( Filename.endsWith('.c4d.xml.json') )
			Pop.Cinema4d.Parse( FileContents, OnActor, OnSpline );
		else
			Pop.Collada.Parse( FileContents, OnActor, OnSpline );
	}
	Filename.forEach ( Load );
	
	return Scene;
}


//	default reads from default timeline
let GetCameraTimelineAndUniform = function()
{
	return [Timeline,'Timeline_CameraPosition'];
}

function GetCameraPath()
{
	const TimelineAndUniform = GetCameraTimelineAndUniform();
	const Timeline = TimelineAndUniform[0];
	const CameraUniform = TimelineAndUniform[1];
	const CameraPositions = [];
	for ( let i=0;	i<Params.DebugCameraPositionCount;	i++ )
	{
		let t = i / Params.DebugCameraPositionCount;
		let Year = Math.lerp( TimelineMinYear, TimelineMaxYear, t );
		let Pos = Timeline.GetUniform( Year, CameraUniform );
		CameraPositions.push( Pos );
	}
	return CameraPositions;
}

function GetTimelineCameraPosition(Year)
{
	const TimelineAndUniform = GetCameraTimelineAndUniform();
	const Timeline = TimelineAndUniform[0];
	const CameraUniform = TimelineAndUniform[1];
	let Pos = Timeline.GetUniform( Year, CameraUniform );
	return Pos;
}

function GetTimelineCamera(Time)
{
	//	apply timeline camera pos temporarily and then remove again
	/*
	 Camera.Position = Math.Add3( Camera.Position, TimelineCameraPos );
	 Camera.LookAt = Math.Add3( Camera.LookAt, TimelineCameraPos );
	 const WorldToCameraTransform = Camera.GetWorldToCameraMatrix();
	 Camera.Position = Math.Subtract3( Camera.Position, TimelineCameraPos );
	 Camera.LookAt = Math.Subtract3( Camera.LookAt, TimelineCameraPos );
	 */
	
	let Camera = new Pop.Camera();
	Camera.Position = GetTimelineCameraPosition(Time);
	if ( Params.CameraFaceForward )
	{
		Camera.LookAt = Camera.Position.slice();
		Camera.LookAt[2] -= 1.0;
	}
	else
	{
		Camera.LookAt = GetTimelineCameraPosition(Time+0.01);
	}
	
	Camera.NearDistance = Params.CameraNearDistance;
	Camera.FarDistance = Params.CameraFarDistance;
	return Camera;
}

function GetRenderCamera(Time)
{
	if ( Params.UseDebugCamera )
		return DebugCamera;
	
	return GetTimelineCamera(Time);
}

//	todo: use generic actor
function TActor(Transform,Geometry,VertShader,FragShader,Uniforms)
{
	this.LocalToWorldTransform = Transform;
	this.Geometry = Geometry;
	this.VertShader = VertShader;
	this.FragShader = FragShader;
	this.Uniforms = Uniforms || [];
	
	this.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
	{
		const Geo = GetAsset( this.Geometry, RenderTarget );
		const Shader = Pop.GetShader( RenderTarget, this.FragShader, this.VertShader );
		
		const SetUniforms = function(Shader)
		{
			SetGlobalUniforms( Shader );
			Shader.SetUniform('LocalToWorldTransform', this.LocalToWorldTransform );
		}
		
		RenderTarget.DrawGeometry( Geo, Shader, SetUniforms.bind(this) );
	}
}

//	get scene graph
function GetRenderScene(Time)
{
	let Scene = [];
	
	let PushDebugCameraActor = function()
	{
		let Camera = GetTimelineCamera(Time);
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Camera.GetLocalToWorldFrustumTransformMatrix();
		Actor.Geometry = 'Cube';
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = EdgeFragShader;
		Scene.push( Actor );
	}
	
	let PushPositionBufferActor = function(Actor)
	{
		if ( Actor.Instances )
		{
			//	turn below into a proper TActor and then draw multiple cases with different transforms
		}
		
		Actor.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
		{
			RenderTriangleBufferActor( RenderTarget, this, ActorIndex, SetGlobalUniforms, Time );
		}
		
		const PositionsTexture = Actor.GetPositionsTexture();
		Actor.Uniforms = [];
		Actor.Uniforms['WorldPositions'] = PositionsTexture;
		Actor.Uniforms['WorldPositionsWidth'] = PositionsTexture.GetWidth();
		Actor.Uniforms['WorldPositionsHeight'] = PositionsTexture.GetHeight();
		Actor.Uniforms['TriangleScale']= Actor.Meta.TriangleScale;
		Actor.Uniforms['Colours']= Actor.Colours;
		Actor.Uniforms['ColourCount']= Actor.Colours.length/3;
		//let a = new TActor( )
		Scene.push( Actor );
	}
	/*
	let ShellAlpha = Timeline.GetUniform(Time,'ShellAlpha');
	if ( ShellAlpha > 0.5 )
		PushPositionBufferActor( Actor_Shell );
	*/
	if ( Actor_Debris )	PushPositionBufferActor( Actor_Debris );

	if ( Actor_Ocean )	PushPositionBufferActor( Actor_Ocean );

	
	let PushCameraPosActor = function(Position)
	{
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...Position);
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( Actor.LocalToWorldTransform, Math.CreateScaleMatrix(LocalScale) );
		Actor.Geometry = 'Cube';
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = ColourFragShader;
		Scene.push( Actor );
	}
	const CameraPositions = GetCameraPath();
	CameraPositions.forEach( PushCameraPosActor );
	
	CameraScene.forEach( a => Scene.push(a) );
	
	if ( Params.UseDebugCamera )
	{
		PushDebugCameraActor();
	}
	
	return Scene;
}


function GetAudioGetCrossFadeDuration()
{
	return Params.AudioCrossFadeDurationSecs;
}

var AppTime = null;
var Hud = {};
var AudioManager = new TAudioManager( GetAudioGetCrossFadeDuration );

//	need a better place for this, app state!
function Init()
{
	AppTime = 0;
	
	Hud.MusicLabel = new Pop.Hud.Label('AudioMusicLabel');
	Hud.VoiceLabel = new Pop.Hud.Label('AudioVoiceLabel');
	Hud.SubtitleLabel = new Pop.Hud.Label('SubtitleLabel');
	Hud.YearLabel = new Pop.Hud.Label('YearLabel');
	Hud.YearSlider = new Pop.Hud.Slider('YearSlider');
	Hud.YearSlider.SetMinMax( TimelineMinInteractiveYear, TimelineMaxInteractiveYear );

	Hud.Stats_Temp = new Pop.Hud.Label('Stats_Temp_Label');
	Hud.Stats_Co2 = new Pop.Hud.Label('Stats_Co2_Label');
	Hud.Stats_Oxygen = new Pop.Hud.Label('Stats_Oxygen_Label');
	Hud.Stats_Ph = new Pop.Hud.Label('Stats_Ph_Label');
}


//	todo: proper app loop, currently triggered from render
function Update(FrameDurationSecs)
{
	if ( AppTime === null )
		Init();
	
	AppTime += FrameDurationSecs;

	//	auto increment year
	if ( Params.ExperiencePlaying )
	{
		const ExpYears = TimelineMaxYear - TimelineMinYear;
		const YearsPerSec = ExpYears / Params.ExperienceDurationSecs;
		const YearsPerFrame = FrameDurationSecs * YearsPerSec;
		Params.TimelineYear += YearsPerFrame;
		ParamsWindow.OnParamChanged('TimelineYear');
	}

	let Time = Params.TimelineYear;

	
	//	update audio
	const CurrentMusic = Timeline.GetUniform( Time, 'Music' );
	AudioManager.SetMusic( CurrentMusic );
	AudioManager.Update( FrameDurationSecs );
	
	
	//	update some stuff from timeline
	Params.FogColour = Timeline.GetUniform( Time, 'FogColour' );
	ParamsWindow.OnParamChanged('FogColour');
	
	//	update hud
	Hud.YearLabel.SetValue( Math.floor(Params.TimelineYear) );
	Hud.YearSlider.SetValue( Params.TimelineYear );
	const MusicDebug = AudioManager.GetMusicQueueDebug();
	const CurrentVoice = Timeline.GetUniform( Time, 'VoiceAudio' );
	const Subtitle = Timeline.GetUniform( Time, 'Subtitle' );
	Hud.MusicLabel.SetValue( MusicDebug );
	Hud.VoiceLabel.SetValue( CurrentVoice );
	Hud.SubtitleLabel.SetValue( Subtitle );

	const DecimalPlaces = 2;
	const Stats_Temp = Timeline.GetUniform( Time, 'Stats_Temp' ).toFixed(DecimalPlaces);
	const Stats_Co2 = Timeline.GetUniform( Time, 'Stats_Co2' ).toFixed(DecimalPlaces);
	const Stats_Oxygen = Timeline.GetUniform( Time, 'Stats_Oxygen' ).toFixed(DecimalPlaces);
	const Stats_Ph = Timeline.GetUniform( Time, 'Stats_Ph' ).toFixed(DecimalPlaces);
	Hud.Stats_Temp.SetValue( Stats_Temp );
	Hud.Stats_Co2.SetValue( Stats_Co2 );
	Hud.Stats_Oxygen.SetValue( Stats_Oxygen );
	Hud.Stats_Ph.SetValue( Stats_Ph );
}



function Render(RenderTarget)
{
	const DurationSecs = 1 / 60;
	Update( DurationSecs );
	
	//let Time = Math.Range( TimelineMinYear, TimelineMaxYear, Params.TimelineYear );
	let Time = Params.TimelineYear;
	
	//	update physics
	if ( Actor_Shell )
		Actor_Shell.PhysicsIteration( DurationSecs, AppTime, RenderTarget );
	if ( Actor_Ocean )
		Actor_Ocean.PhysicsIteration( DurationSecs, AppTime, RenderTarget );
	if ( Actor_Debris )
		Actor_Debris.PhysicsIteration( DurationSecs, AppTime, RenderTarget );

	RenderTarget.ClearColour( ...Params.FogColour );
	
	const RenderCamera = GetRenderCamera( Time );
	const Viewport = RenderTarget.GetRenderTargetRect();
	const CameraProjectionTransform = RenderCamera.GetProjectionMatrix(Viewport);
	const WorldToCameraTransform = RenderCamera.GetWorldToCameraMatrix();
	const CameraToWorldTransform = Math.MatrixInverse4x4(WorldToCameraTransform);

	const Scene = GetRenderScene(Time);
	let RenderSceneActor = function(Actor,ActorIndex)
	{
		const SetGlobalUniforms = function(Shader)
		{
			Shader.SetUniform('WorldToCameraTransform', WorldToCameraTransform );
			Shader.SetUniform('CameraToWorldTransform', CameraToWorldTransform );
			Shader.SetUniform('CameraProjectionTransform', CameraProjectionTransform );
			Shader.SetUniform('Fog_MinDistance',Params.FogMinDistance);
			Shader.SetUniform('Fog_MaxDistance',Params.FogMaxDistance);
			Shader.SetUniform('Fog_Colour',Params.FogColour);
			Shader.SetUniform('Light_Colour', Params.LightColour );
			Shader.SetUniform('Light_MinPower', 0.1 );
			Shader.SetUniform('Light_MaxPower', 1.0 );
		
			Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		
			//	actor specific
			let SetUniform = function(Key)
			{
				let Value = Actor.Uniforms[Key];
				Shader.SetUniform( Key, Value );
			}
			Object.keys( Actor.Uniforms ).forEach( SetUniform );
		}
		
		Actor.Render( RenderTarget, ActorIndex, SetGlobalUniforms, Time );
	}
	Scene.forEach( RenderSceneActor );
	
}


function OnSwitchedToDebugCamera()
{
	//	erk, not grabbing from single place
	let Year = Params.TimelineYear;
	
	//	snap debug camera to run from current viewing position
	let TimelineCamera = GetTimelineCamera(Year);
	DebugCamera.Position = TimelineCamera.Position.slice();
	DebugCamera.LookAt = TimelineCamera.LookAt.slice();
}

function SwitchToDebugCamera()
{
	if ( Params.UseDebugCamera )
		return;
	
	Params.UseDebugCamera = true;
	ParamsWindow.OnParamChanged('UseDebugCamera');
}


//CameraSpline.c4d.xml.json
const CameraScene = LoadCameraScene('CameraSpline.dae.json');
//const CameraScene = LoadCameraScene(['CameraSpline.c4d.xml.json','CameraSpline.dae.json']);

const Timeline = LoadTimeline('Timeline.json');



//	now in bootup
//const Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = Render;

Window.OnMouseDown = function(x,y,Button)
{
	Window.OnMouseMove( x, y, Button, true );
}

Window.OnMouseMove = function(x,y,Button,FirstClick=false)
{
	if ( Button == 0 )
	{
		SwitchToDebugCamera();
		DebugCamera.OnCameraPanLocal( x, 0, y, FirstClick );
	}
	if ( Button == 2 )
	{
		SwitchToDebugCamera();
		DebugCamera.OnCameraPanLocal( x, y, 0, FirstClick );
	}
	if ( Button == 1 )
	{
		SwitchToDebugCamera();
		DebugCamera.OnCameraOrbit( x, y, 0, FirstClick );
	}
}

Window.OnMouseScroll = function(x,y,Button,Delta)
{
	SwitchToDebugCamera();
	DebugCamera.OnCameraPanLocal( 0, 0, 0, true );
	DebugCamera.OnCameraPanLocal( 0, 0, Delta[1] * -10, false );
}

