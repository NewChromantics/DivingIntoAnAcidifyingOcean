Pop.Opengl.ShaderCache = [];

//	modify object, but don't store a reference to it! otherwise it wont garbage collect
var UniqueHashCounter = 1000;
function GetUniqueHash(Object)
{
	let HashPrefix = 'object_hash#';
	
	//	the string is the hash
	if ( typeof Object == 'string' )
		return Object;
	
	if ( typeof Object != 'object' )
		throw "Need to work out how to store unique hash on a " + (typeof Object);

	//	objects are passed by reference, so we can add a hash
	if ( Object._UniqueHash !== undefined )
		return Object._UniqueHash;
	
	UniqueHashCounter++;
	Object._UniqueHash = HashPrefix + UniqueHashCounter;
	Pop.Debug("Created new hash for object: " + Object._UniqueHash );
	
	return Object._UniqueHash;
}


let Counter = 100;
Pop.GetShader = function(RenderContext, FragSource, VertSource)
{
	//	javascript will get an index for arrays via toString()
	//	we need them unique for this case
	//	so error if the objects-as-keys have default names
	//	assume caller is handling this, if we did this here and stored object references
	//	https://stackoverflow.com/questions/194846/is-there-any-kind-of-hash-code-function-in-javascript
	let ContextKey = GetUniqueHash( RenderContext );
	let SourceKey = GetUniqueHash( FragSource );

	if ( !Pop.Opengl.ShaderCache[ContextKey] )
	{
		Pop.Opengl.ShaderCache[ContextKey] = [];
		Pop.Debug("New ShaderCache for render context " + ContextKey);
	}
	
	if ( !Pop.Opengl.ShaderCache[ContextKey][SourceKey] )
	{
		let Shader = new Pop.Opengl.Shader( RenderContext, VertSource, FragSource );
		Shader.Counter = Counter++;
		//Pop.Debug("pre Shader keys: " + Object.keys(Pop.Opengl.ShaderCache[ContextKey]) );
		Pop.Opengl.ShaderCache[ContextKey][SourceKey] = Shader;
		//Pop.Debug("New ShaderCache[] " + Shader.Counter + " for FragSource " + SourceKey );
		//Pop.Debug("post Shader keys: " + Object.keys(Pop.Opengl.ShaderCache[ContextKey]) );
	}
	/*
	let MatchingShader = null;
	let MatchShader = function(ShaderKey,Index)
	{
		let Shader = Pop.Opengl.ShaderCache[ContextKey][ShaderKey];
		Pop.Debug("Key #" + Index + " counter=" + Shader.Counter);
		if ( ShaderKey != SourceKey )
			return;
		Pop.Debug("Key #" + Index + " is match");
		MatchingShader = Shader;
	}
	Object.keys(Pop.Opengl.ShaderCache[ContextKey]).forEach( MatchShader );
	Pop.Debug("picked match counter=" + MatchingShader.Counter);
	return MatchingShader;
	*/
	let Shader = Pop.Opengl.ShaderCache[ContextKey][SourceKey];
	//Debug( Shader.Counter );
	return Shader;
}

