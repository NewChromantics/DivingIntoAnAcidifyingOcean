
const Logo = {};
Logo.Camera = new Pop.Camera();

function Logo_GetScene()
{
	return [];
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
