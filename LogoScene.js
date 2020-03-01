var OceanColourTexture = new Pop.Image('OceanColourTexture');
Pop.Include('ParticleActor.js');




const Logo = {};
Logo.Camera = new Pop.Camera();
Logo.WaterActor = null;

function Logo_GetScene()
{
	if (!Logo.OceanActor)
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

function Update_LogoScene(FirstUpdate,FrameDuration,StateTime)
{
	if (FirstUpdate)
	{
		Pop.Debug('Update_LogoScene FirstUpdate');
		//	setup renderer
		Window.OnRender = Scene_Render;

		Scene_GetRenderScene = Logo_GetScene;
		Scene_GetRenderCamera = Logo_GetCamera;
	}

	return 'Logo';
}
