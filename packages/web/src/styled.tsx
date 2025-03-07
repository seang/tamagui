import { stylePropsAll } from '@tamagui/helpers'

import { createComponent } from './createComponent'
import { ReactNativeStaticConfigs } from './setupReactNative'
import {
  GetProps,
  GetVariantValues,
  MediaProps,
  PseudoProps,
  StaticConfig,
  StylableComponent,
  TamaguiComponent,
  TamaguiElement,
  VariantDefinitions,
  VariantSpreadFunction,
} from './types'

// TODO may be able to use this in the options?: arg below directly
export type StyledOptions<ParentComponent extends StylableComponent> =
  GetProps<ParentComponent> & {
    name?: string
    variants?: VariantDefinitions<ParentComponent> | undefined
    defaultVariants?: { [key: string]: any }
  }

type GetBaseProps<A extends StylableComponent> = A extends TamaguiComponent<
  any,
  any,
  infer P
>
  ? P
  : GetProps<A>

type GetVariantProps<A extends StylableComponent> = A extends TamaguiComponent<
  any,
  any,
  any,
  infer V
>
  ? V
  : {}

export function styled<
  ParentComponent extends StylableComponent,
  Variants extends VariantDefinitions<ParentComponent> | void = VariantDefinitions<ParentComponent> | void
>(
  Component: ParentComponent,
  // this should be Partial<GetProps<ParentComponent>> but causes excessively deep type issues
  options?: GetProps<ParentComponent> & {
    name?: string
    variants?: Variants | undefined
    // thought i had this typed, but can't get it linked
    defaultVariants?: { [key: string]: any }
    acceptsClassName?: boolean
  },
  staticExtractionOptions?: Partial<StaticConfig>
) {
  // validate not using a variant over an existing valid style
  if (process.env.NODE_ENV !== 'production') {
    if (!Component) {
      throw new Error(`No component given to styled()`)
    }
    if (options?.variants) {
      for (const key in options.variants) {
        if (key in stylePropsAll) {
          console.error(
            `Invalid variant key overlaps with style key: ${key}. Tamagui prevents defining variants that use valid style keys to reduce implementation complexity.`
          )
        }
      }
    }
  }

  const staticConfigProps = (() => {
    const parentStaticConfig =
      'staticConfig' in Component ? (Component.staticConfig as StaticConfig) : null

    if (options) {
      const {
        variants,
        name,
        defaultVariants,
        acceptsClassName: acceptsClassNameProp,
        ...defaultProps
      } = options
      if (defaultVariants) {
        Object.assign(defaultProps, defaultVariants)
      }
      const isReactNative = Boolean(
        ReactNativeStaticConfigs.has(Component) ||
          ReactNativeStaticConfigs.has(parentStaticConfig?.Component) ||
          parentStaticConfig?.isReactNative ||
          staticExtractionOptions?.isReactNative
      )
      const isTamagui = !isReactNative && !!parentStaticConfig

      const Comp = isReactNative
        ? parentStaticConfig?.Component || Component
        : (Component as any)
      const nativeConf = (isReactNative && ReactNativeStaticConfigs.get(Comp)) || null

      const isText = Boolean(
        staticExtractionOptions?.isText || parentStaticConfig?.isText
      )
      const acceptsClassName = acceptsClassNameProp ?? (isTamagui || isReactNative)

      const conf: Partial<StaticConfig> = {
        ...staticExtractionOptions,
        ...(!isTamagui && {
          Component: Comp,
        }),
        // this type gets messed up by options?: Partial<GetProps<ParentComponent>> above
        // take away the Partial<> and it's fine
        variants,
        defaultProps,
        defaultVariants,
        componentName: name,
        isReactNative,
        isText,
        acceptsClassName,
        ...nativeConf,
      }

      // bail on non className views as well
      if (defaultProps.children || !acceptsClassName) {
        conf.neverFlatten = true
      }

      return conf
    }
    return {}
  })()

  const component = createComponent(staticConfigProps, Component)

  // get parent props without pseudos and medias so we can rebuild both with new variants
  // get parent props without pseudos and medias so we can rebuild both with new variants
  type ParentPropsBase = GetBaseProps<ParentComponent>
  type ParentVariants = GetVariantProps<ParentComponent>

  type OurVariants = Variants extends void
    ? {}
    : {
        [Key in keyof Variants]?: Variants[Key] extends VariantSpreadFunction<
          any,
          infer Val
        >
          ? Val
          : GetVariantValues<keyof Variants[Key]>
      }

  type VariantProps = Omit<ParentVariants, keyof OurVariants> & OurVariants
  type OurPropsBase = ParentPropsBase & VariantProps

  type Props = Variants extends void
    ? GetProps<ParentComponent>
    : // start with base props
      OurPropsBase &
        // add in media (+ pseudos nested)
        MediaProps<Partial<OurPropsBase>> &
        // add in pseudos
        PseudoProps<Partial<OurPropsBase>>

  type StyledComponent = TamaguiComponent<
    Props,
    TamaguiElement,
    ParentPropsBase,
    ParentVariants & OurVariants
  >

  return component as StyledComponent
}

// sanity check types
// import { Stack } from './views/Stack'
// const X = styled(Stack, {
//   variants: {
//     size: {
//       '...size': (val) => {
//         return {
//           pointerEvents: 'auto'
//         }
//       }
//     },
//     disabled: {
//       true: {
//         alignContent: 'center',
//         opacity: 0.5,
//         pointerEvents: 'none',
//       },
//     },
//   } as const
// })
// // type variants = GetStyledVariants<typeof X>
// const y = <X disabled size="$10" />
