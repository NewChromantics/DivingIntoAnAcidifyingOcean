var OceanColourTexture = new Pop.Image('OceanColourTexture');

const Water0_Pos = [0,2.85092,-8.61732];
const CameraInitial_Pos = [0,3.92589,11.737];
const CameraInitial_Look = CameraInitial_Pos.slice();
CameraInitial_Look[2] -= 1;
//0,3.283590021812135,7.744724626735667

//	ShowError is global HTML error func
if (!ShowError)
	ShowError = Pop.Debug;

const Logo = {};
Logo.Camera = CreateLogoCamera();
Logo.WaterActor = null;
Logo.PreloadsFinished = false;
Logo.SwirlActor = null;

//	files we need to preload before the "preload stuff"
const LoadJsPreloadFilenames = [
	'Animals.js',
	'Animals.json',
	'LoadExperience.js',
];

function CreateLogoCamera()
{
	const Camera = new Pop.Camera();
	Camera.Position = CameraInitial_Pos.slice();
	Camera.LookAt = CameraInitial_Look.slice();
	Camera.FarDistance = 400;	//	try not to clip anythig in debug mode
	return Camera;
}

function MouseControlCamera()
{
	const DebugCamera = Logo.Camera;
	Window.OnMouseDown = function (x,y,Button)
	{
		Window.OnMouseMove(x,y,Button,true);
	}

	Window.OnMouseMove = function (x,y,Button,FirstClick = false)
	{
		if (Button == 0)
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			DebugCamera.OnCameraPanLocal(x,0,-y,FirstClick);
		}
		if (Button == 2)
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			DebugCamera.OnCameraPanLocal(x,y,0,FirstClick);
		}
		if (Button == 1)
		{
			DebugCamera.OnCameraOrbit(x,y,0,FirstClick);
		}
		Pop.Debug(DebugCamera.Position);
	}

	Window.OnMouseScroll = function (x,y,Button,Delta)
	{
		let Fly = Delta[1] * 10;
		Fly *= Params.ScrollFlySpeed;

		DebugCamera.OnCameraPanLocal(0,0,0,true);
		DebugCamera.OnCameraPanLocal(0,0,Fly,false);
	}
}

function CreateSwirlActor()
{
	function GetSplineStartPos()
	{
		const Pos = CameraInitial_Pos.slice();
		Pos[0] += Params.LogoSwirl_StartPositionX;
		Pos[1] += Params.LogoSwirl_StartPositionY;
		Pos[2] += Params.LogoSwirl_StartPositionZ;
		return Pos;
	}

	//	reset previous asset
	//	gr: maybe need a better idea here (like set an incrementing function name, or generate the asset now)
	InvalidateAsset('GenerateRandomSplinePathVertexes()');
	let Actor = new TActor();
	Actor.Name = "Swirl";
	let SplineStartPos = GetSplineStartPos();
	Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...SplineStartPos);

	SetupSwirlTextureBufferActor.call(Actor,GetSwirlMeta(Actor).Filename,GetSwirlMeta);
	//Acid.SwirlActors.push(Actor);
	Actor.EnablePhysics();
	//Actor.BoundingBox.Min = [-100,-100,-100];
	//Actor.BoundingBox.Max = [100,100,100];
	Pop.Debug("Created swirl",Actor);

	return Actor;
}

function Logo_GetScene()
{
	//Pop.Debug("Logo_GetScene");
	if (!Logo.WaterActor)
	{
		const ActorNode = {};
		ActorNode.BoundingBox = {};
		ActorNode.BoundingBox.Min = [-25,0,-25];
		ActorNode.BoundingBox.Max = [25,0,25];
		ActorNode.Position = [0,2.85092,-8.61732];
		ActorNode.Name = 'Ocean_surface_0';

		const Actor = new TActor();
		Actor.Name = ActorNode.Name;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...ActorNode.Position);
		Actor.BoundingBox = ActorNode.BoundingBox;
				
		SetupAnimalTextureBufferActor.call(Actor,GetWaterMeta().Filename,GetWaterMeta);
		Logo.WaterActor = Actor;
	}

	//	regen swirl when it hides
	if (Logo.SwirlActor)
	{
		const SplineTime = Logo.SwirlActor.GetMeta().PhysicsUniforms.SplineTime;
		//Pop.Debug("SplineTime",SplineTime);
		if (SplineTime > 0.2)
			Logo.SwirlActor = null;
	}

	if (!Logo.SwirlActor)
	{
		Logo.SwirlActor = CreateSwirlActor();
	}

	
	return [Logo.WaterActor,Logo.SwirlActor];
}

function Logo_GetCamera()
{
	return Logo.Camera;
}


function Logo_GetGlobalUniforms()
{
	let Uniforms = Object.assign({},Params);
	Uniforms['Debug_ForceColour'] = true;
	Uniforms['Fog_MinDistance'] = Params.FogMinDistance;
	Uniforms['Fog_MaxDistance'] = Params.FogMaxDistance;
	Uniforms['Fog_Colour'] = Params.FogColour;
	Uniforms['Fog_WorldPosition'] = Logo_GetCamera().Position;

	return Uniforms;
}

function Update_LogoScene(FirstUpdate,FrameDuration,StateTime)
{
	async function PreloadFiles()
	{
		const Promises = [];
		for (const Filename of LoadJsPreloadFilenames)
		{
			Promises.push(Pop.AsyncCacheAssetAsString(Filename));
		}
		await Promise.all(Promises);
		Logo.PreloadsFinished = true;
	}

	if (FirstUpdate)
	{
		Params.YearsPerSecond = 0.2;

		Pop.Debug('Update_LogoScene FirstUpdate');
		//	setup renderer
		Window.OnRender = Scene_Render;

		MouseControlCamera();

		Scene_GetRenderScene = Logo_GetScene;
		Scene_GetRenderCamera = Logo_GetCamera;
		Scene_GetDebugTextures = Logo_GetDebugTextures;
		Scene_GetGlobalUniforms = Logo_GetGlobalUniforms;

		InitOceanColourTexture();

		Logo.PreloadPromise = PreloadFiles().then().catch(ShowError);

		//Params.Ocean_TriangleScale = 0;
		Params.AnimalBufferLod = 0;
	}

	//	smoothly reveal ocean particles
	//	gr: noise via lod!
	//	fade in faster if we've finished loading
	const FadeInRate = Logo.PreloadsFinished ? 1 : 0.2;
	Params.AnimalBufferLod += FrameDuration * FadeInRate;//Params.OceanLodFadeInPerSec;
	Params.AnimalBufferLod = Math.min(Params.AnimalBufferLod,1);

	Logo_Update(FrameDuration);
	
	if (Logo.PreloadsFinished && Params.AnimalBufferLod >= 1)
	{
		Params.AnimalBufferLod = 1;
		Pop.Include('LoadExperience.js');
		return 'LoadExperience';
	}
}


function Logo_GetDebugTextures()
{
	return [
		OceanColourTexture,
		RandomTexture,
		Noise_TurbulenceTexture,
	];
}

var AppTime = 0;


function UpdateNoise(FrameDurationSecs)
{
	const UpdateNoiseBlit = function (RenderTarget)
	{
		const NoiseTime = AppTime * Params.Turbulence_TimeScalar;
		//Pop.Debug("Update noise texture",NoiseTime);
		UpdateNoiseTexture(RenderTarget,Noise_TurbulenceTexture,Noise_TurbulenceShader,NoiseTime);
	}

	GpuJobs.push(UpdateNoiseBlit);
}

function Logo_UpdatePhysics(FrameDurationSecs)
{
	const UpdateActorPhysics = function (RenderTarget)
	{
		const UpdateActorPhysics = function (Actor)
		{
			//	only update actors visible
			//	gr: maybe do this with the actors in scene from GetRenderScene?
			const UpdatePhysicsUniforms = function (Shader)
			{
				const Bounds = Actor.BoundingBox.Min.concat(Actor.BoundingBox.Max);
				Shader.SetUniform('OrigPositionsBoundingBox',Bounds);
			}
			Actor.PhysicsIteration(FrameDurationSecs,AppTime,RenderTarget,UpdatePhysicsUniforms);
		}

		//const Scene = GetActorScene_OnlyVisible();
		const Scene = Logo_GetScene();

		//	update physics
		const PhysicsEnabled = true;
		let PhsyicsUpdateCount = 0;
		if (PhysicsEnabled || PhsyicsUpdateCount == 0)
		{
			try
			{
				Scene.forEach(UpdateActorPhysics);
				PhsyicsUpdateCount++;
			}
			catch (e)
			{
				Pop.Debug("UpdateActorPhysics error",e);
			}
		}
	}
	GpuJobs.push(UpdateActorPhysics);
}

//	match Acid_Update()
function Logo_Update(FrameDurationSecs)
{
	//AppTime += FrameDurationSecs;
	AppTime += 1 / 60;

	UpdateNoise(FrameDurationSecs);
	Logo_UpdatePhysics(FrameDurationSecs);
}

function InitOceanColourTexture()
{
	UpdateColourTexture(0,OceanColourTexture,'Ocean_Colour');
	UpdateColourTexture(0,SwirlColourTexture,'Swirl_Colour');

}


