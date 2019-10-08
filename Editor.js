Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopCinema4d.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');
Pop.Include('PopEngineCommon/PopFrameCounter.js');
Pop.Include('PopEngineCommon/PopCamera.js');

Pop.Include('ParticleActor.js');

const SceneFilename = 'CameraSpline.dae.json';

var Noise_TurbulenceTexture = new Pop.Image( [512,512], 'Float4' );
var OceanColourTexture = new Pop.Image();
var DebrisColourTexture = new Pop.Image();

const GpuJobs = [];

const PhysicsEnabled = true;
var PhsyicsUpdateCount = 0;	//	gotta do one


Params.DrawBoundingBoxes = true;
Params.DrawHighlightedActors = true;

//var EditorParams = {};
const EditorParams = Params;
//EditorParams.ActorNodeName = 'Animal_XXX';
EditorParams.ActorNodeName = OceanActorPrefix + 'x';
EditorParams.ActorNodeName = SceneFilename;
EditorParams.ActorNodeName = DustActorPrefix;
EditorParams.ActorNodeName = SwirlActorPrefix;

EditorParams.EnablePhysicsAfterSecs = 2;

EditorParams.Turbulence_Frequency = 4.0;
EditorParams.Turbulence_Amplitude = 1.0;
EditorParams.Turbulence_Lacunarity = 0.10;
EditorParams.Turbulence_Persistence = 0.20;
EditorParams.Turbulence_TimeScalar = 0.14;

EditorParams.Swirl_BezierNodeCount = 5;
EditorParams.Swirl_BezierPointCount = 100;
EditorParams.Swirl_BezierLinearTest = false;
EditorParams.Swirl_Test_ControlPoint = true;

const ReloadSceneOnParamChanged = ['ActorNodeName','Reload','Swirl_BezierNodeCount','Swirl_BezierPointCount','Swirl_BezierLinearTest','Swirl_Test_ControlPoint'];

var Hud = {};
InitDebugHud(Hud);




function CreateDebugCamera(Window,OnClicked,OnGrabbedCamera,OnMouseMove)
{
	OnClicked = OnClicked || function(){};
	OnGrabbedCamera = OnGrabbedCamera || function(){};
	OnMouseMove = OnMouseMove || function(){};

	const Camera = new Pop.Camera();
	Camera.Position = [0,0.5,2];
	
	Window.OnMouseDown = function(x,y,Button)
	{
		if ( Button == 0 )
		{
			OnClicked( x, y );
		}
		Window.OnMouseMove( x, y, Button, true );
	}
	
	Window.OnMouseMove = function(x,y,Button,FirstClick=false)
	{
		OnMouseMove( x, y );
		
		if ( Button == 0 )
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			Camera.OnCameraPanLocal( x, 0, -y, FirstClick );
		}
		if ( Button == 2 )
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			OnGrabbedCamera(true);
			Camera.OnCameraPanLocal( x, y, 0, FirstClick );
		}
		if ( Button == 1 )
		{
			OnGrabbedCamera(true);
			Camera.OnCameraOrbit( x, y, 0, FirstClick );
		}
	}
	
	Window.OnMouseScroll = function(x,y,Button,Delta)
	{
		let Fly = Delta[1] * 10;
		Fly *= Params.ScrollFlySpeed;
		
		OnGrabbedCamera(true);
		Camera.OnCameraPanLocal( 0, 0, 0, true );
		Camera.OnCameraPanLocal( 0, 0, Fly, false );
	}
	
	return Camera;
}


function FlushGpuJobs(RenderTarget)
{
	const RunJob = function(Job)
	{
		Job( RenderTarget );
	}
	GpuJobs.forEach( RunJob );
	
	GpuJobs.length = 0;
}


function GetRenderScene(GetActorScene,Time)
{
	let Scene = [];
	
	let PushActorBox = function(LocalToWorldTransform,BoundsMin,BoundsMax,Filled=Params.DrawBoundingBoxesFilled)
	{
		//	bounding box to matrix...
		const BoundsSize = Math.Subtract3( BoundsMax, BoundsMin );
		
		//	cube is currently -1..1 so compensate. Need to change shader if we change this
		BoundsSize[0] /= 2;
		BoundsSize[1] /= 2;
		BoundsSize[2] /= 2;
		
		const BoundsCenter = Math.Lerp3( BoundsMin, BoundsMax, 0.5 );
		let BoundsMatrix = Math.CreateTranslationMatrix(...BoundsCenter);
		BoundsMatrix = Math.MatrixMultiply4x4( BoundsMatrix, Math.CreateScaleMatrix(...BoundsSize) );
		BoundsMatrix = Math.MatrixMultiply4x4( LocalToWorldTransform, BoundsMatrix );
		
		const BoundsActor = new TActor();
		const BoundsLocalScale = []
		BoundsActor.LocalToWorldTransform = BoundsMatrix;
		BoundsActor.Geometry = 'Cube';
		BoundsActor.RenderShader = GeoEdgeShader;
		BoundsActor.Uniforms['ChequerFrontAndBack'] = Filled;
		BoundsActor.Uniforms['ChequerSides'] = Filled;
		BoundsActor.Uniforms['LineWidth'] = 0.05;
		
		Scene.push( BoundsActor );
	}
	
	let PushActorBoundingBox = function(Actor,ForceDraw)
	{
		if ( !ForceDraw )
			if ( !Params.DrawBoundingBoxes && !Params.DrawBoundingBoxesFilled )
				return;
		
		//	has no bounds!
		const BoundingBox = Actor.GetBoundingBox();
		if ( !BoundingBox )
		{
			Pop.Debug("Actor has no bounds",Actor);
			return;
		}
		
		PushActorBox( Actor.GetLocalToWorldTransform(), BoundingBox.Min, BoundingBox.Max );
	}
	
	
	
	let PushCameraPosActor = function(Position)
	{
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...Position);
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( Actor.LocalToWorldTransform, Math.CreateScaleMatrix(LocalScale) );
		Actor.Geometry = 'Cube';
		Actor.RenderShader = GeoColourShader;
		Scene.push( Actor );
	}
	
	function RenderTextureQuad(Texture,TextureIndex)
	{
		if ( !Texture.Pixels )
			return;
		
		let w = 0.1;
		let h = 0.2;
		let x = 0.1;
		let y = 0.1 + (TextureIndex * h * 1.10);
		
		const Uniforms = {};
		Uniforms['VertexRect'] = [x, y, w, h ];
		Uniforms['Texture'] = Texture;
		
		const Actor = new TActor( null, 'Quad', BlitCopyShader, Uniforms );
		Scene.push( Actor );
	}
	
	const DebugTextures = [];
	//if ( Params.DebugNoiseTextures )
	{
		DebugTextures.push( OceanColourTexture );
		DebugTextures.push( DebrisColourTexture );
		DebugTextures.push( RandomTexture );
		DebugTextures.push( Noise_TurbulenceTexture );
	}
	DebugTextures.forEach( RenderTextureQuad );
	
	const ActorScene = GetActorScene();
	ActorScene.forEach( a => PushActorBoundingBox(a) );
	ActorScene.forEach( a => Scene.push(a) );
	
	
	return Scene;
}


function GetEditorRenderScene(ActorScene,Time)
{
	function GetActorScene()
	{
		return ActorScene;
	}
	
	const RenderScene = GetRenderScene( GetActorScene, Time );
	return RenderScene;
}

function CreateCubeActor(ActorNode,Solid=false)
{
	let Actor = new TActor();
	Actor.Name = ActorNode.Name;
	
	let LocalScale = ActorNode.Scale;
	let WorldPos = ActorNode.Position;
	Actor.Geometry = 'Cube';
	
	let RenderAsBounds = true;
	
	//	some nodes have no geometry, so no bounding box
	if ( !ActorNode.BoundingBox )
	{
		ActorNode.BoundingBox = {};
		ActorNode.BoundingBox.Min = [0,0,0];
		ActorNode.BoundingBox.Max = [1,1,1];
		RenderAsBounds = false;
	}
	
	if ( RenderAsBounds )
	{
		//	undo the bounds scale and render the cube at the bounds scale
		//	but that'll scale bounds too, so undo that (just to 0..1)
		let BoundsCenter = Math.Lerp3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min, 0.5 );
		let BoundsScale = Math.Subtract3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min );
		
		BoundsScale = Math.Multiply3( BoundsScale, [0.5,0.5,0.5] );
		
		LocalScale = BoundsScale;
		WorldPos = Math.Add3( WorldPos, BoundsCenter );
		ActorNode.BoundingBox.Max = [1,1,1];
		ActorNode.BoundingBox.Min = [-1,-1,-1];
		Pop.Debug( ActorNode.Name, "BoundsScale", BoundsScale, "ActorNode.Scale", ActorNode.Scale );
	}
	
	let LocalScaleMtx = Math.CreateScaleMatrix( ...LocalScale );
	let WorldPosMtx = Math.CreateTranslationMatrix( ...WorldPos );
	
	Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( WorldPosMtx, LocalScaleMtx );
	
	Actor.RenderShader = (Solid===true) ? GeoColourShader : GeoEdgeShader;
	Actor.BoundingBox = ActorNode.BoundingBox;
	
	return Actor;
}


//	gr: this isn't quadratic, which type is it?
Math.GetBezierPosition = function(Start,Middle,End,Time)
{
	Pop.Debug("Time",Time);
	//	expecting time here to be 0-1
	//	linear test
	const LinearTest = EditorParams.Swirl_BezierLinearTest;
	
	function GetBezier(p0,p1,p2,t)
	{
		const oneMinusT = 1 - t;
		const oneMinusTsq = oneMinusT * oneMinusT;
		const tsq = t*t;
		return (p0*oneMinusTsq) + (p1 * 4.0 * t * oneMinusT) + (p2 * tsq);
	}
	
	//	calculate the middle control point so it goes through middle
	//	https://stackoverflow.com/a/6712095/355753
	//const ControlMiddle_x = GetBezier(Start[0], Middle[0], End[0], 0.5 );
	//const ControlMiddle_y = GetBezier(Start[1], Middle[1], End[1], 0.5 );
	//const ControlMiddle_z = GetBezier(Start[2], Middle[2], End[2], 0.5 );
	const GetControl = function(a,b,c,Index)
	{
		const p0 = a[Index];
		const p1 = b[Index];
		const p2 = c[Index];
		
		//	x(t) = x0 * (1-t)^2 + 2 * x1 * t * (1 - t) + x2 * t^2
		//	x(t=1/2) = xt = x0 * 1/4 + 2 * x1 * 1/4 + x2 * 1/4
		//	x1/2 = xt - (x0 + x2)/4
		let pc = p1 - ((p0 + p2)/4);
		return pc;

		//	need to work out what p1/middle/control point should be when
		//	t=0.5 == p1
		//	https://stackoverflow.com/a/9719997/355753
		//const pc = 2 * (p1 - (p0 + p2)/2);
		//return pc;
	}
	const ControlMiddle_x = GetControl( Start, Middle, End, 0 );
	const ControlMiddle_y = GetControl( Start, Middle, End, 1 );
	const ControlMiddle_z = GetControl( Start, Middle, End, 2 );
	const ControlMiddle = [ ControlMiddle_x, ControlMiddle_y, ControlMiddle_z ];
	
	function GetLinear(p0,p1,p2,t)
	{
		if ( t <= 0.5 )
		{
			t /= 0.5;
			return p0 + ((p1-p0)*t);
		}
		else
		{
			t -= 0.5;
			t /= 0.5;
			return p1 + ((p2-p1)*t);
		}
	}
	
	
	let Position = [];
	for ( let i=0;	i<Start.length;	i++ )
	{
		let p0 = Start[i];
		let p2 = End[i];

		if ( LinearTest )
		{
			let p1 = Params.Swirl_Test_ControlPoint ? ControlMiddle[i] : Middle[i];
			Position[i] = GetLinear( p0, p1, p2, Time );
		}
		else
		{
			let p1 = ControlMiddle[i];
			Position[i] = GetBezier( p0, p1, p2, Time );
		}
	}
	return Position;
}

//	https://stackoverflow.com/questions/7054272/how-to-draw-smooth-curve-through-n-points-using-javascript-html5-canvas
Math.GetBezierPathPosition3 = function(Path,Time)
{
	if ( Path.length < 3 )
		throw "Bezier path must have at least 3 points (this has "+ Path.length + ")";

	//Time *= Path.length-1;
	
	//	get index from time
	let Middle = Math.round( Time );
	let Start = Middle-1;
	
	//	clamp
	if ( Start < 0 )
	{
		Start = 0;
	}
	
	Middle = Start + 1;
	let End = Middle + 1;
	
	//	clamp
	if ( End >= Path.length )
	{
		End = Path.length-1;
		Middle = End-1;
		Start = Middle-1;
	}

	//	turn lerp middle->end to start->end
	//	gr: could just be *= 0.5?
	Lerp = Math.range( Start, End, Time );
	
	if ( Middle != Start+1 )	throw "Start/Middle/End error " + String.join( ...arguments );
	if ( End != Middle+1 )	throw "Start/Middle/End error " + String.join( ...arguments );
	

	const Pos = Math.GetBezierPosition( Path[Start], Path[Middle], Path[End], Lerp );
	return Pos;
}




let FirstRandomSet = null;

function CreateSwirlActors(PushActor)
{
	function PushBezierPointActor(xyz,Index,Size)
	{
		if ( !xyz )
			return;
		const Node = {};
		Node.Scale = [Size,Size,Size];
		Node.Position = xyz;
		Node.Name = 'x';
		const Actor = CreateCubeActor( Node, true );
		PushActor(Actor);
	}
	
	if ( !FirstRandomSet )
	{
		FirstRandomSet = [];
		//	make some random points for the bezier
		for ( let p=0;	p<EditorParams.Swirl_BezierNodeCount;	p++ )
		{
			let x = Math.random();
			let y = Math.random();
			let z = Math.random();
			FirstRandomSet.push([x,y,z]);
		}
	}
	const PathPoints = FirstRandomSet;
	
	Pop.Debug("Fill bezier");
	
	//	now fill bezier inbetween
	const BezierPoints = [];
	for ( let i=0;	i<EditorParams.Swirl_BezierPointCount;	i++ )
	{
		let t = i / (EditorParams.Swirl_BezierPointCount-1);
		t *= EditorParams.Swirl_BezierNodeCount - 1;
		const Pos = Math.GetCatmullPathPosition( PathPoints, t );
		PushBezierPointActor( Pos, 0, 0.01 );
	}
	
	PathPoints.forEach( a => PushBezierPointActor(a,0,0.03) );
}

function CreateSplineActor(Spline)
{
	//	turn into bezier
	Pop.Debug("Spline",Spline);
}

function CreateEditorActorScene()
{
	let Scene = [];
	
	let OnActor = function(ActorNode)
	{
		if ( ActorNode.Name == SceneFilename )
		{
			GetDebugSceneActors( SceneFilename, a => Scene.push(a) );
			return;
		}
	
		Pop.Debug("Loading actor", ActorNode.Name, ActorNode );
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
	
		let IsAnimalActor = true;//IsActorSelectable(Actor);
		const IsDebrisActor = ActorNode.Name.startsWith(DebrisActorPrefix);
		const IsDustActor = ActorNode.Name.startsWith(DustActorPrefix);
		const IsOceanActor = ActorNode.Name.startsWith(OceanActorPrefix);
		const IsSwirlActor = ActorNode.Name.startsWith(SwirlActorPrefix);
		
		if ( IsSwirlActor )
		{
			CreateSwirlActors( a => Scene.push(a) );
			return;
		}
		
		let WorldPos = ActorNode.Position;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix( ...WorldPos );
		Actor.BoundingBox = ActorNode.BoundingBox;
		
		if ( IsSwirlActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetSwirlMeta().Filename, GetSwirlMeta );
		}
		else if ( IsDustActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetDustMeta().Filename, GetDustMeta );
		}
		else if ( IsOceanActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetOceanMeta().Filename, GetOceanMeta );
		}
		else if ( IsDebrisActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetDebrisMeta().Filename, GetDebrisMeta );
		}
		else
		{
			const Animal = GetRandomAnimal( ActorNode.Name );
			Actor.Animal = Animal;
			Actor.Name += " " + Animal.Name;
			let GetMeta = GetAnimalMeta;
			if ( ActorNode.Name.startsWith( NastyAnimalPrefix ) )
				GetMeta = GetNastyAnimalMeta;
			if ( ActorNode.Name.startsWith( BigBangAnimalPrefix ) )
				GetMeta = GetBigBangAnimalMeta;
			SetupAnimalTextureBufferActor.call( Actor, Animal.Model, GetMeta );
		}
		
		/*
		const Animal = GetRandomAnimal( ActorNode.Name );
		Actor.Animal = Animal;
		Actor.Name += " " + Animal.Name;
		let GetMeta = GetAnimalMeta;
		if ( ActorNode.Name.startsWith( NastyAnimalPrefix ) )
			GetMeta = GetNastyAnimalMeta;
		if ( ActorNode.Name.startsWith( BigBangAnimalPrefix ) )
			GetMeta = GetBigBangAnimalMeta;
		SetupAnimalTextureBufferActor.call( Actor, Animal.Model, GetMeta );
		 */
		Scene.push( Actor );
	}
	
	//	create a dumb actor
	let PreviewActorNode = {};
	PreviewActorNode.Name = EditorParams.ActorNodeName;
	
	PreviewActorNode.BoundingBox = {};
	PreviewActorNode.BoundingBox.Min = [-10,-10,-10];
	PreviewActorNode.BoundingBox.Max = [10,10,10];
	PreviewActorNode.Scale = [1,1,1];
	PreviewActorNode.Position = [0,0,0];
	
	OnActor( PreviewActorNode );
	
	Scene = Scene.filter( a => (a!=null) );
	
	return Scene;
}



function GetDebugSceneActors(Filename,EnumActor)
{
	const FileScene = LoadSceneFile(Filename);
	//	ignore the actors
	const CubeActors = FileScene.Actors.map( CreateCubeActor );
	CubeActors.forEach( EnumActor );
	
	//	draw splines
	const SplineActors = FileScene.Splines.map( CreateSplineActor );
	SplineActors.forEach( EnumActor );
	
	/*
	 const Timeline = new TTimeline( FileScene.Keyframes );
	 GetCameraTimelineAndUniform = function()
	 {
	 return [Timeline,'CameraPosition'];
	 }
	 */
}


class TAssetEditor
{
	constructor(Name)
	{
		this.Window = new Pop.Opengl.Window(Name);
		this.Window.OnRender = this.Render.bind(this);
		this.Camera = CreateDebugCamera(this.Window);
		this.Time = 0;
		this.Scene = CreateEditorActorScene();
		this.SceneInitTime = this.Time;

		this.CreateEditorParamsWindow();
	}
	
	Update(FrameDurationSecs,Time)
	{
		this.Time = Time;
		//Pop.Debug("Update",FrameDurationSecs);
		
		const SceneTime = ( this.Time - this.SceneInitTime );
		if ( SceneTime > EditorParams.EnablePhysicsAfterSecs )
		{
			this.Scene[0].UpdatePhysics = true;
		}
		
		
		const AppTime = Time;
		const Params = EditorParams;
		
		const UpdateNoise = function(RenderTarget)
		{
			const NoiseTime = AppTime * Params.Turbulence_TimeScalar;
			UpdateNoiseTexture( RenderTarget, Noise_TurbulenceTexture, Noise_TurbulenceShader, NoiseTime );
		}
		
		const Scene = this.Scene;
		const UpdateActorPhysics = function(RenderTarget)
		{
			const UpdateActorPhysics = function(Actor)
			{
				//	only update actors visible
				//	gr: maybe do this with the actors in scene from GetRenderScene?
				const UpdatePhysicsUniforms = function(Shader)
				{
					const Bounds = Actor.BoundingBox.Min.concat( Actor.BoundingBox.Max );
					Shader.SetUniform('OrigPositionsBoundingBox',Bounds);
				}
				Actor.PhysicsIteration( FrameDurationSecs, AppTime, RenderTarget, UpdatePhysicsUniforms );
			}
			
			
			//	update physics
			if ( PhysicsEnabled || PhsyicsUpdateCount == 0 )
			{
				Scene.forEach( UpdateActorPhysics );
				PhsyicsUpdateCount++;
			}
		}
		
		GpuJobs.push( UpdateNoise );
		GpuJobs.push( UpdateActorPhysics );
	}
	

	Render(RenderTarget)
	{
		FlushGpuJobs( RenderTarget );

		const Scene = GetEditorRenderScene( this.Scene, this.Time );
		
		//Pop.Debug("Render",RenderTarget);
		RenderTarget.ClearColour( ...EditorParams.FogColour );
		
		const GlobalUniforms = {};
		GlobalUniforms['Fog_MinDistance'] = 100;
		GlobalUniforms['Fog_MaxDistance'] = 100;
		GlobalUniforms['Fog_Colour'] = [1,0,0];
		GlobalUniforms['Fog_WorldPosition'] = this.Camera.Position;

		RenderScene( Scene, RenderTarget, this.Camera, this.Time, GlobalUniforms );
		
		Window.RenderFrameCounter.Add();
		UpdateDebugHud(Hud);
	}
	
	CreateEditorParamsWindow()
	{
		const ParamsWindowRect = [1100,20,350,450];
		this.ParamsWindow = CreateParamsWindow( EditorParams, this.OnEditorParamsChanged.bind(this), ParamsWindowRect );
		
		this.ParamsWindow.AddParam('ActorNodeName');
		this.ParamsWindow.AddParam('Reload','Button');
		this.ParamsWindow.AddParam('EnablePhysicsAfterSecs',0,10);
		this.ParamsWindow.AddParam('Swirl_BezierNodeCount',4,200,Math.floor);
		this.ParamsWindow.AddParam('Swirl_BezierPointCount',1,500,Math.floor);
		this.ParamsWindow.AddParam('Swirl_BezierLinearTest');
		this.ParamsWindow.AddParam('Swirl_Test_ControlPoint');
		

		EditorParams.InitParamsWindow( this.ParamsWindow );
	}
	
	OnEditorParamsChanged(Params,ChangedParamName)
	{
		Pop.Debug("Param changed",ChangedParamName);
		
		if ( ChangedParamName == 'Swirl_BezierNodeCount' )
		{
			FirstRandomSet = null;
		}

		
		//	reload scene if actor changes
		if ( ReloadSceneOnParamChanged.includes(ChangedParamName) )
		{
			this.Scene = CreateEditorActorScene();
			this.SceneInitTime = this.Time;
		}
	}
	
}


