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
	
	return [Logo.WaterActor];
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
		for (const Filename of LoadJsPreloadFilenames)
		{
			await Pop.AsyncCacheAssetAsString(Filename);
		}
		Logo.PreloadsFinished = true;
	}

	if (FirstUpdate)
	{
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
	}

	Logo_Update(FrameDuration);
	
	if (Logo.PreloadsFinished)
	{
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
	const UpdateNoise = function (RenderTarget)
	{
		const NoiseTime = AppTime * Params.Turbulence_TimeScalar;
		//Pop.Debug("Update noise texture",NoiseTime);
		UpdateNoiseTexture(RenderTarget,Noise_TurbulenceTexture,Noise_TurbulenceShader,NoiseTime);
	}

	GpuJobs.push(UpdateNoise);
}


//	match Acid_Update()
function Logo_Update(FrameDurationSecs)
{
	//AppTime += FrameDurationSecs;
	AppTime += 1 / 60;

	UpdateNoise(FrameDurationSecs);
}

function InitOceanColourTexture()
{
	UpdateColourTexture(0,OceanColourTexture,'Ocean_Colour');
}


