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
EditorParams.BackgroundColour = [0,0,0.3];
//EditorParams.ActorNodeName = 'Animal_XXX';
//EditorParams.ActorNodeName = OceanActorPrefix + 'x';
EditorParams.ActorNodeName = BigBangAnimalPrefix + 'xxx';
EditorParams.EnablePhysicsAfterSecs = 2;

EditorParams.Turbulence_Frequency = 4.0;
EditorParams.Turbulence_Amplitude = 1.0;
EditorParams.Turbulence_Lacunarity = 0.10;
EditorParams.Turbulence_Persistence = 0.20;
EditorParams.Turbulence_TimeScalar = 0.14;


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


function CreateEditorActorScene()
{
	let Scene = [];
	
	let OnActor = function(ActorNode)
	{
		Pop.Debug("Loading actor", ActorNode.Name, ActorNode );
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
	
		let IsAnimalActor = true;//IsActorSelectable(Actor);
		const IsDebrisActor = ActorNode.Name.startsWith(DebrisActorPrefix);
		const IsOceanActor = ActorNode.Name.startsWith(OceanActorPrefix);
		
		let WorldPos = ActorNode.Position;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix( ...WorldPos );
		Actor.BoundingBox = ActorNode.BoundingBox;
		
		
		if ( IsOceanActor )
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
	
	return Scene;
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
		RenderTarget.ClearColour( ...EditorParams.BackgroundColour );
		
		const GlobalUniforms = {};
		GlobalUniforms['Fog_MinDistance'] = 100;
		GlobalUniforms['Fog_MaxDistance'] = 100;
		GlobalUniforms['Fog_Colour'] = [1,0,0];
		GlobalUniforms['Fog_WorldPosition'] = this.Camera.Position;

		RenderScene( Scene, RenderTarget, this.Camera, this.Time, GlobalUniforms );
	}
	
	CreateEditorParamsWindow()
	{
		const ParamsWindowRect = [1100,20,350,450];
		this.ParamsWindow = CreateParamsWindow( EditorParams, this.OnEditorParamsChanged.bind(this), ParamsWindowRect );
		this.ParamsWindow.AddParam('BackgroundColour','Colour');
		this.ParamsWindow.AddParam('ActorNodeName');
		this.ParamsWindow.AddParam('EnablePhysicsAfterSecs',0,10);
	}
	
	OnEditorParamsChanged(Params,ChangedParamName)
	{
		Pop.Debug("Param changed",ChangedParamName);
		
		//	reload scene if actor changes
		if ( ChangedParamName == 'ActorNodeName' )
		{
			this.Scene = CreateEditorActorScene();
			this.SceneInitTime = this.Time;
		}
	}
	
}


