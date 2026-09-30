#include "Items/EnderContentLibrary.h"

#include "Ender.h"
#include "UObject/UnrealType.h"

FGameplayTag UEnderContentLibrary::MakeGameplayTag(const FString& TagName)
{
	if (TagName.IsEmpty())
	{
		return FGameplayTag();
	}
	return FGameplayTag::RequestGameplayTag(FName(*TagName), /*ErrorIfNotFound*/ false);
}

bool UEnderContentLibrary::SetPropertyFromText(UObject* Object, FName PropertyName, const FString& Text)
{
	if (!Object)
	{
		return false;
	}
	FProperty* Property = Object->GetClass()->FindPropertyByName(PropertyName);
	if (!Property)
	{
		UE_LOG(LogEnder, Warning, TEXT("SetPropertyFromText: %s has no property %s"), *Object->GetName(), *PropertyName.ToString());
		return false;
	}
	Object->Modify();
	void* Value = Property->ContainerPtrToValuePtr<void>(Object);
	const TCHAR* Result = Property->ImportText_Direct(*Text, Value, Object, PPF_None);
	if (!Result)
	{
		UE_LOG(LogEnder, Warning, TEXT("SetPropertyFromText: could not import '%s' into %s.%s"), *Text, *Object->GetName(), *PropertyName.ToString());
		return false;
	}
	Object->MarkPackageDirty();
	return true;
}
