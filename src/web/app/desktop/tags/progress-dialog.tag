mk-progress-dialog
	mk-window@window(is-modal={ false }, can-close={ false }, width={ '500px' })
		<yield to="header">
		| { parent.title }
		mk-ellipsis
		</yield>
		<yield to="content">
		div.body
			p.init(if={ isNaN(parent.value) })
				| 待機中
				mk-ellipsis
			p.percentage(if={ !isNaN(parent.value) }) { Math.floor((parent.value / parent.max) * 100) }
			progress(if={ !isNaN(parent.value) && parent.value < parent.max }, value={ isNaN(parent.value) ? 0 : parent.value }, max={ parent.max })
			div.progress.waiting(if={ parent.value >= parent.max })
		</yield>

style.
	display block

	> mk-window
		[data-yield='content']

			> .body
				padding 18px 24px 24px 24px

				> .init
					display block
					margin 0
					text-align center
					color rgba(#000, 0.7)

				> .percentage
					display block
					margin 0 0 4px 0
					text-align center
					line-height 16px
					color rgba($theme-color, 0.7)

					&:after
						content '%'

				> progress
				> .progress
					display block
					margin 0
					width 100%
					height 10px
					background transparent
					border none
					border-radius 4px
					overflow hidden

					&::-webkit-progress-value
						background $theme-color

					&::-webkit-progress-bar
						background rgba($theme-color, 0.1)

				> .progress
					background linear-gradient(
						45deg,
						lighten($theme-color, 30%) 25%,
						$theme-color               25%,
						$theme-color               50%,
						lighten($theme-color, 30%) 50%,
						lighten($theme-color, 30%) 75%,
						$theme-color               75%,
						$theme-color
					)
					background-size 32px 32px
					animation progress-dialog-tag-progress-waiting 1.5s linear infinite

					@keyframes progress-dialog-tag-progress-waiting
						from {background-position: 0 0;}
						to   {background-position: -64px 32px;}

script.
	@title = @opts.title
	@value = parse-int @opts.value, 10
	@max = parse-int @opts.max, 10

	@on \mount ~>
		@refs.window.on \closed ~>
			@unmount!

	@update-progress = (value, max) ~>
		@value = parse-int value, 10
		@max = parse-int max, 10
		@update!

	@close = ~>
		@refs.window.close!
