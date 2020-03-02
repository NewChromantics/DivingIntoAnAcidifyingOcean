var OceanColourTexture = new Pop.Image('OceanColourTexture');




const Logo = {};
Logo.Camera = CreateLogoCamera();
Logo.WaterActor = null;

function CreateLogoCamera()
{
	const Camera = new Pop.Camera();
	Camera.Position = [0,0,0];
	Camera.LookAt = [0,0,-10];
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
	if (!Logo.WaterActor)
	{
		const Actor = new TActor();

		//	copy default node from whichever is the first
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(0,0,0);
		Actor.BoundingBox = {};
		Actor.BoundingBox.Min = [0,0,0];
		Actor.BoundingBox.Max = [1,1,1];

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
	const Uniforms = [];
	Uniforms['Debug_ForceColour'] = true;
	Uniforms['Fog_MinDistance'] = 1000;
	Uniforms['Fog_MaxDistance'] = 1000;
	Uniforms['Fog_Colour'] = [1,0,0];
	Uniforms['Fog_WorldPosition'] = [0,0,0];

	return Uniforms;
}

function Update_LogoScene(FirstUpdate,FrameDuration,StateTime)
{
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
	}

	return 'Logo';
}


function Logo_GetDebugTextures()
{
	return [
		OceanColourTexture,
		Noise_TurbulenceTexture,
	];
}

//	match Acid_Update()
function Logo_Update(FrameDurationSecs)
{
	const UpdateNoise = function (RenderTarget)
	{
		const NoiseTime = AppTime * Params.Turbulence_TimeScalar;
		UpdateNoiseTexture(RenderTarget,Noise_TurbulenceTexture,Noise_TurbulenceShader,NoiseTime);
	}
	GpuJobs.push(UpdateNoise);
}