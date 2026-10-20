<?php
/**
 * Plugin Name: سرزمین حرف‌ها
 * Description: بازی دونده‌ی آموزش حروف فارسی. با کد کوتاه [sarzamin_harf] توی هر برگه یا نوشته نمایش داده می‌شود.
 * Version: 0.1.0
 * Author: —
 * Text Domain: sarzamin-e-harfha
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * [sarzamin_harf height="760px" max_width="520px"]
 * The game lives in its own page (game/index.html) and is shown in an iframe, so it never
 * clashes with the theme's CSS or scripts. It works with any width, from phones to desktops.
 */
function sarzamin_harf_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'height'    => 'min(88vh, 780px)',
			'max_width' => '520px',
		),
		$atts,
		'sarzamin_harf'
	);

	// only allow simple CSS lengths (px, %, vh, vw, em, rem, min(), max(), calc())
	$len = function ( $value, $fallback ) {
		return preg_match( '/^[0-9a-z%(),.\s+\-*\/]+$/i', $value ) ? $value : $fallback;
	};
	$height    = $len( $atts['height'], 'min(88vh, 780px)' );
	$max_width = $len( $atts['max_width'], '520px' );

	$src = plugins_url( 'game/index.html', __FILE__ );

	return sprintf(
		'<div class="sarzamin-harf" style="max-width:%1$s;margin:0 auto;"><iframe src="%2$s" title="%3$s" loading="lazy" allow="autoplay; fullscreen" allowfullscreen style="display:block;width:100%%;height:%4$s;border:0;border-radius:18px;background:#cfeeff;"></iframe></div>',
		esc_attr( $max_width ),
		esc_url( $src ),
		esc_attr( 'سرزمین حرف‌ها' ),
		esc_attr( $height )
	);
}
add_shortcode( 'sarzamin_harf', 'sarzamin_harf_shortcode' );
